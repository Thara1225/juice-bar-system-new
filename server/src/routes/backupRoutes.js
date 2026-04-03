const express = require("express");
const router = express.Router();
const {
  listAvailableBackups,
  triggerBackup,
  triggerRestore,
  downloadBackupFile,
  deleteBackupFile,
} = require("../controllers/backupController");
const { authenticate, authorize } = require("../middleware/authMiddleware");

router.use(authenticate, authorize("admin"));
router.get("/", listAvailableBackups);
router.get("/download/:fileName", downloadBackupFile);
router.delete("/file/:fileName", deleteBackupFile);
router.post("/run", triggerBackup);
router.post("/restore", triggerRestore);

module.exports = router;
