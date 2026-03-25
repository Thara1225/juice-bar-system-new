const express = require("express");
const router = express.Router();

const {
  createOrder,
  getPendingOrders,
  getReadyOrders,
  updateOrderStatus,
  getAllOrders,
  getSalesSummary,
  exportOrders,
  getCashierKitchenAssistMode,
  setCashierKitchenAssistMode,
} = require("../controllers/orderController");
const { authenticate, authorize } = require("../middleware/authMiddleware");

router.post("/", authenticate, authorize("cashier", "admin"), createOrder);
router.get("/", authenticate, authorize("admin", "cashier", "kitchen"), getAllOrders);
router.get("/export", authenticate, authorize("admin"), exportOrders);
router.get("/summary", authenticate, authorize("admin"), getSalesSummary);
router.get("/pending", getPendingOrders);
router.get("/ready", getReadyOrders);
router.get("/kitchen-assist-mode", getCashierKitchenAssistMode);
router.patch("/kitchen-assist-mode", authenticate, authorize("admin"), setCashierKitchenAssistMode);
router.patch("/:id/status", authenticate, authorize("admin", "kitchen", "cashier"), updateOrderStatus);

module.exports = router;
