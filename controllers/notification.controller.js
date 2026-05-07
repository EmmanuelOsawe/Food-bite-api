const webpush = require("web-push");
const { Notification } = require("../models/notification.model");
const { PushSubscription } = require("../models/pushSubscription.model");
const { getIO } = require("../config/socket.config");

// Configure web-push with VAPID keys (set these in .env)
webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL}`,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// ─── Helper: broadcast a new-food notification ────────────────────────────────
// Called internally from food.controller after a food is created

const broadcastNewFood = async (food) => {
  try {
    // 1. Save notification to DB
    const notification = await Notification.create({
      type: "new_food",
      title: "🍽️ New item on the menu!",
      message: `${food.name} has just been added. Check it out!`,
      food: food._id,
      recipient: null, // broadcast to all
    });

    const payload = {
      id: notification._id,
      type: "new_food",
      title: notification.title,
      message: notification.message,
      food: {
        _id: food._id,
        name: food.name,
        image: food.image?.url || null,
        price: food.price,
        category: food.category,
      },
      link: `/foods/${food._id}`,  // frontend route
      createdAt: notification.createdAt,
    };

    // 2. Emit via Socket.IO to all connected clients
    const io = getIO();
    io.emit("new_food_notification", payload);

    // 3. Send browser push to all subscribed users
    const subscriptions = await PushSubscription.find();
    const pushPayload = JSON.stringify({
      title: notification.title,
      body: notification.message,
      icon: food.image?.url || "/icons/food-icon.png",
      data: { url: `/foods/${food._id}` },
    });

    const pushPromises = subscriptions.map((sub) =>
      webpush
        .sendNotification(sub.subscription, pushPayload)
        .catch(async (err) => {
          // Remove stale/expired subscriptions
          if (err.statusCode === 410 || err.statusCode === 404) {
            await PushSubscription.deleteOne({ _id: sub._id });
          }
        })
    );

    await Promise.allSettled(pushPromises);

    return notification;
  } catch (error) {
    console.error("Broadcast new food error:", error);
  }
};

// ─── CUSTOMER: Save push subscription ────────────────────────────────────────
// POST /api/notifications/subscribe

exports.savePushSubscription = async (req, res) => {
  try {
    const { subscription } = req.body;

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({
        success: false,
        message: "Invalid push subscription object.",
      });
    }

    // Upsert — one subscription per user
    await PushSubscription.findOneAndUpdate(
      { user: req.user._id },
      { user: req.user._id, subscription },
      { upsert: true, new: true }
    );

    res.status(200).json({ success: true, message: "Push subscription saved." });
  } catch (error) {
    console.error("Save subscription error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── CUSTOMER: Unsubscribe from push notifications ────────────────────────────
// DELETE /api/notifications/subscribe

exports.removePushSubscription = async (req, res) => {
  try {
    await PushSubscription.findOneAndDelete({ user: req.user._id });
    res.status(200).json({ success: true, message: "Unsubscribed from push notifications." });
  } catch (error) {
    console.error("Remove subscription error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── CUSTOMER: Get my notifications ──────────────────────────────────────────
// GET /api/notifications

exports.getMyNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({
      $or: [{ recipient: req.user._id }, { recipient: null }],
    })
      .sort("-createdAt")
      .limit(20)
      .populate("food", "name image price");

    // Attach isRead flag per user
    const result = notifications.map((n) => ({
      ...n.toObject(),
      isRead: n.readBy.some((id) => id.toString() === req.user._id.toString()),
    }));

    const unreadCount = result.filter((n) => !n.isRead).length;

    res.status(200).json({ success: true, unreadCount, notifications: result });
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── CUSTOMER: Mark notification as read ─────────────────────────────────────
// PATCH /api/notifications/:id/read

exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found." });
    }

    // Add user to readBy if not already there
    if (!notification.readBy.includes(req.user._id)) {
      notification.readBy.push(req.user._id);
      await notification.save();
    }

    res.status(200).json({ success: true, message: "Marked as read." });
  } catch (error) {
    console.error("Mark as read error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── CUSTOMER: Mark all notifications as read ─────────────────────────────────
// PATCH /api/notifications/read-all

exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      {
        $or: [{ recipient: req.user._id }, { recipient: null }],
        readBy: { $ne: req.user._id },
      },
      { $push: { readBy: req.user._id } }
    );

    res.status(200).json({ success: true, message: "All notifications marked as read." });
  } catch (error) {
    console.error("Mark all read error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Expose VAPID public key to frontend ──────────────────────────────────────
// GET /api/notifications/vapid-public-key

exports.getVapidPublicKey = (req, res) => {
  res.status(200).json({ success: true, publicKey: process.env.VAPID_PUBLIC_KEY });
};

module.exports = {
  ...exports,
  broadcastNewFood,
};
