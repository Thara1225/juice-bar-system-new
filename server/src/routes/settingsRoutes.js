const express = require("express");
const router = express.Router();
const {
  getBusinessSettings,
  updateBusinessSettings,
} = require("../controllers/settingsController");
const { authenticate, authorize } = require("../middleware/authMiddleware");

router.get("/", getBusinessSettings);
router.put("/", authenticate, authorize("admin"), updateBusinessSettings);

module.exports = router;
