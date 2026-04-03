const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
require("dotenv").config();

const BACKUP_DIR = process.env.DB_BACKUP_DIR || path.resolve(process.cwd(), "backups");
const RETENTION_DAYS = Number(process.env.DB_BACKUP_RETENTION_DAYS || 14);

const ensureBackupDir = () => {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
};

const runCommand = (command, args, env = process.env) => {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, shell: false, stdio: ["ignore", "pipe", "pipe"] });

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr || `${command} failed with code ${code}`));
      }
    });
  });
};

const parseDatabaseUrl = () => {
  const raw =
    process.env.NEON_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL;

  if (!raw) {
    throw new Error("No database URL configured. Set NEON_DATABASE_URL or DATABASE_URL");
  }

  const parsed = new URL(raw);
  if (parsed.hostname === "base") {
    throw new Error(
      "Invalid DB host 'base'. Set DATABASE_URL (or NEON_DATABASE_URL) directly to your Neon URL"
    );
  }

  const dbName = parsed.pathname.replace(/^\//, "");

  return {
    host: parsed.hostname,
    port: parsed.port || "5432",
    database: dbName,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
  };
};

const resolveBackupFilePath = (backupFileName) => {
  ensureBackupDir();

  const rawName = String(backupFileName || "").trim();
  if (!rawName) {
    throw new Error("Backup file name is required");
  }

  const safeFileName = path.basename(rawName);
  if (safeFileName !== rawName) {
    throw new Error("Invalid backup file name");
  }

  if (!safeFileName.endsWith(".dump")) {
    throw new Error("Only .dump backup files are supported");
  }

  const filePath = path.join(BACKUP_DIR, safeFileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Backup file not found: ${safeFileName}`);
  }

  return {
    fileName: safeFileName,
    filePath,
  };
};

const createBackup = async () => {
  ensureBackupDir();

  const db = parseDatabaseUrl();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `juice-bar-${timestamp}.dump`;
  const filePath = path.join(BACKUP_DIR, fileName);

  await runCommand(
    process.env.PG_DUMP_BIN || "pg_dump",
    [
      "-h", db.host,
      "-p", db.port,
      "-U", db.user,
      "-F", "c",
      "-d", db.database,
      "-f", filePath,
    ],
    {
      ...process.env,
      PGPASSWORD: db.password,
    }
  );

  return { fileName, filePath, createdAt: new Date().toISOString() };
};

const restoreBackup = async (backupFileName) => {
  const db = parseDatabaseUrl();
  const { filePath } = resolveBackupFilePath(backupFileName);

  await runCommand(
    process.env.PG_RESTORE_BIN || "pg_restore",
    [
      "-h", db.host,
      "-p", db.port,
      "-U", db.user,
      "-d", db.database,
      "--clean",
      "--if-exists",
      filePath,
    ],
    {
      ...process.env,
      PGPASSWORD: db.password,
    }
  );

  return { restoredFrom: backupFileName, restoredAt: new Date().toISOString() };
};

const deleteBackup = async (backupFileName) => {
  const { fileName, filePath } = resolveBackupFilePath(backupFileName);

  fs.unlinkSync(filePath);

  return {
    deletedFile: fileName,
    deletedAt: new Date().toISOString(),
  };
};

const cleanupOldBackups = () => {
  ensureBackupDir();

  const threshold = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const files = fs.readdirSync(BACKUP_DIR).filter((name) => name.endsWith(".dump"));

  const deleted = [];

  files.forEach((fileName) => {
    const filePath = path.join(BACKUP_DIR, fileName);
    const stats = fs.statSync(filePath);

    if (stats.mtimeMs < threshold) {
      fs.unlinkSync(filePath);
      deleted.push(fileName);
    }
  });

  return { deleted, retentionDays: RETENTION_DAYS };
};

const listBackups = () => {
  ensureBackupDir();

  return fs
    .readdirSync(BACKUP_DIR)
    .filter((name) => name.endsWith(".dump"))
    .map((fileName) => {
      const filePath = path.join(BACKUP_DIR, fileName);
      const stats = fs.statSync(filePath);

      return {
        fileName,
        sizeBytes: stats.size,
        modifiedAt: stats.mtime.toISOString(),
      };
    })
    .sort((a, b) => (a.modifiedAt < b.modifiedAt ? 1 : -1));
};

module.exports = {
  createBackup,
  restoreBackup,
  deleteBackup,
  cleanupOldBackups,
  listBackups,
  resolveBackupFilePath,
};
