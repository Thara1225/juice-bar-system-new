const {
  createBackup,
  restoreBackup,
  deleteBackup,
  cleanupOldBackups,
  listBackups,
  resolveBackupFilePath,
} = require("../services/dbBackupService");

const listAvailableBackups = async (req, res) => {
  try {
    res.json(listBackups());
  } catch (error) {
    res.status(500).json({ error: "Failed to list backups" });
  }
};

const triggerBackup = async (req, res) => {
  try {
    const backup = await createBackup();
    const cleanup = cleanupOldBackups();
    res.status(201).json({ backup, cleanup });
  } catch (error) {
    res.status(500).json({ error: `Backup failed: ${error.message}` });
  }
};

const triggerRestore = async (req, res) => {
  try {
    const fileName = String(req.body.file_name || "").trim();

    if (!fileName) {
      return res.status(400).json({ error: "file_name is required" });
    }

    const result = await restoreBackup(fileName);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: `Restore failed: ${error.message}` });
  }
};

const downloadBackupFile = async (req, res) => {
  try {
    const fileName = String(req.params.fileName || "").trim();

    if (!fileName) {
      return res.status(400).json({ error: "fileName is required" });
    }

    const resolved = resolveBackupFilePath(fileName);
    return res.download(resolved.filePath, resolved.fileName);
  } catch (error) {
    const statusCode = String(error.message || "").includes("not found") ? 404 : 400;
    return res.status(statusCode).json({ error: `Download failed: ${error.message}` });
  }
};

const deleteBackupFile = async (req, res) => {
  try {
    const fileName = String(req.params.fileName || "").trim();

    if (!fileName) {
      return res.status(400).json({ error: "fileName is required" });
    }

    const result = await deleteBackup(fileName);
    return res.json(result);
  } catch (error) {
    const statusCode = String(error.message || "").includes("not found") ? 404 : 400;
    return res.status(statusCode).json({ error: `Delete failed: ${error.message}` });
  }
};

module.exports = {
  listAvailableBackups,
  triggerBackup,
  triggerRestore,
  downloadBackupFile,
  deleteBackupFile,
};
