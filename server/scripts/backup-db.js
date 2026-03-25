const { createBackup, cleanupOldBackups } = require("../src/services/dbBackupService");

(async () => {
  try {
    const backup = await createBackup();
    const cleanup = cleanupOldBackups();

    console.log("Backup created:", backup.fileName);
    console.log("Cleanup deleted:", cleanup.deleted.length);
  } catch (error) {
    console.error("Backup failed:", error.message);
    process.exit(1);
  }
})();
