const cron = require("node-cron");
const { createBackup, cleanupOldBackups } = require("./dbBackupService");

const startBackupScheduler = () => {
  const expression = process.env.DB_BACKUP_CRON || "0 2 * * *";

  cron.schedule(expression, async () => {
    try {
      const backup = await createBackup();
      const cleanup = cleanupOldBackups();

      console.log(
        `[BackupScheduler] Backup created ${backup.fileName}; deleted ${cleanup.deleted.length} old backups`
      );
    } catch (error) {
      console.error(`[BackupScheduler] Backup failed: ${error.message}`);
    }
  });
};

module.exports = {
  startBackupScheduler,
};
