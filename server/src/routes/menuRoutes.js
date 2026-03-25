const express = require("express");
const router = express.Router();
const {
  getMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
} = require("../controllers/menuController");
const { authenticate, authorize } = require("../middleware/authMiddleware");

router.get("/", getMenuItems);
router.post("/", authenticate, authorize("admin"), createMenuItem);
router.put("/:id", authenticate, authorize("admin"), updateMenuItem);
router.delete("/:id", authenticate, authorize("admin"), deleteMenuItem);

module.exports = router;
