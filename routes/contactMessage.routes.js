const express = require("express");
const router = express.Router();
const {
  sendMessage,
  getAllMessages,
  markAsRead,
  deleteMessage,
} = require("../controllers/contactMessage.controller");
const { protect, restrictTo } = require("../middleware/auth.middleware");

// Public — anyone can send a message
router.post("/", sendMessage);

// Admin only
router.get("/", protect, restrictTo("admin"), getAllMessages);
router.patch("/:id/read", protect, restrictTo("admin"), markAsRead);
router.delete("/:id", protect, restrictTo("admin"), deleteMessage);

module.exports = router;
