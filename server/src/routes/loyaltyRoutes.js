const express = require("express");
const router = express.Router();
const {
  getLoyaltyByPhone,
  redeemLoyaltyPoints,
  getLoyaltyLeaderboard,
} = require("../controllers/loyaltyController");

router.get("/leaderboard", getLoyaltyLeaderboard);
router.post("/redeem", redeemLoyaltyPoints);
router.get("/:phone", getLoyaltyByPhone);

module.exports = router;
