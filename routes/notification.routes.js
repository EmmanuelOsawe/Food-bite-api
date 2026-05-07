const express = require("express");
const router = express.Router();
const {
  savePushSubscription,
  removePushSubscription,
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  getVapidPublicKey,
} = require("../controllers/notification.controller");
const { protect } = require("../middleware/auth.middleware");

// Public — frontend needs this to register push
router.get("/vapid-public-key", getVapidPublicKey);

// Protected
router.post("/subscribe", protect, savePushSubscription);
router.delete("/subscribe", protect, removePushSubscription);
router.get("/", protect, getMyNotifications);
router.patch("/read-all", protect, markAllAsRead);
router.patch("/:id/read", protect, markAsRead);

module.exports = router;