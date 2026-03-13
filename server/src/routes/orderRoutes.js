const express = require("express");
const router = express.Router();

const {
  createOrder,
  getPendingOrders,
  getReadyOrders,
  updateOrderStatus,
} = require("../controllers/orderController");

router.post("/", createOrder);
router.get("/pending", getPendingOrders);
router.get("/ready", getReadyOrders);
router.patch("/:id/status", updateOrderStatus);

module.exports = router;