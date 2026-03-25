const { restoreBackup } = require("../src/services/dbBackupService");

(async () => {
  const fileName = process.argv[2];

  if (!fileName) {
    console.error("Usage: node scripts/restore-db.js <backup-file-name.dump>");
    process.exit(1);
  }

  try {
    const result = await restoreBackup(fileName);
    console.log("Restore completed:", result.restoredFrom);
  } catch (error) {
    console.error("Restore failed:", error.message);
    process.exit(1);
  }
})();
