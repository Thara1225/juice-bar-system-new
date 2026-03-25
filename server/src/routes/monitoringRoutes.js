const express = require("express");
const router = express.Router();
const {
  healthCheck,
  uptimeSummary,
} = require("../controllers/monitoringController");

router.get("/health", healthCheck);
router.get("/uptime", uptimeSummary);

module.exports = router;
