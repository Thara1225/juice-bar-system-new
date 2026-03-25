const express = require("express");
const router = express.Router();
const {
  listUsers,
  createUser,
  updateUser,
  resetUserPassword,
} = require("../controllers/userController");
const { authenticate, authorize } = require("../middleware/authMiddleware");

router.use(authenticate, authorize("admin"));
router.get("/", listUsers);
router.post("/", createUser);
router.patch("/:id", updateUser);
router.patch("/:id/password", resetUserPassword);

module.exports = router;
