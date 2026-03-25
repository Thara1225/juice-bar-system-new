const express = require("express");
const router = express.Router();
const {
  getPromoCodes,
  createPromoCode,
  getHappyHours,
  createHappyHourRule,
} = require("../controllers/promoController");
const { authenticate, authorize } = require("../middleware/authMiddleware");

router.get("/codes", authenticate, authorize("admin"), getPromoCodes);
router.post("/codes", authenticate, authorize("admin"), createPromoCode);
router.get("/happy-hours", authenticate, authorize("admin"), getHappyHours);
router.post("/happy-hours", authenticate, authorize("admin"), createHappyHourRule);

module.exports = router;
