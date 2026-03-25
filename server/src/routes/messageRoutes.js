const express = require("express");
const router = express.Router();
const {
  getMessages,
  createMessage,
  archiveMessage,
} = require("../controllers/messageController");
const { authenticate, authorize } = require("../middleware/authMiddleware");

router.get("/", getMessages);
router.post("/", authenticate, authorize("admin"), createMessage);
router.patch("/:id/archive", authenticate, authorize("admin"), archiveMessage);

module.exports = router;
