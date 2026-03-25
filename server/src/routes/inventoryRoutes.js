const express = require("express");
const router = express.Router();
const {
  getIngredients,
  createIngredient,
  assignIngredientToMenuItem,
  getLowStockAlerts,
} = require("../controllers/inventoryController");
const { authenticate, authorize } = require("../middleware/authMiddleware");

router.get("/ingredients", authenticate, authorize("admin"), getIngredients);
router.post("/ingredients", authenticate, authorize("admin"), createIngredient);
router.post("/menu-items/:menuItemId/ingredients", authenticate, authorize("admin"), assignIngredientToMenuItem);
router.get("/alerts/low-stock", authenticate, authorize("admin"), getLowStockAlerts);

module.exports = router;
