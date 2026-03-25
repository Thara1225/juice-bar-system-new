const express = require("express");
const router = express.Router();
const {
  listAvailableBackups,
  triggerBackup,
  triggerRestore,
} = require("../controllers/backupController");
const { authenticate, authorize } = require("../middleware/authMiddleware");

router.use(authenticate, authorize("admin"));
router.get("/", listAvailableBackups);
router.post("/run", triggerBackup);
router.post("/restore", triggerRestore);

module.exports = router;
