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
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error("DATABASE_URL is not configured");
  }

  const parsed = new URL(raw);
  const dbName = parsed.pathname.replace(/^\//, "");

  return {
    host: parsed.hostname,
    port: parsed.port || "5432",
    database: dbName,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
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
  ensureBackupDir();

  const db = parseDatabaseUrl();
  const filePath = path.join(BACKUP_DIR, backupFileName);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Backup file not found: ${backupFileName}`);
  }

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
  cleanupOldBackups,
  listBackups,
};
