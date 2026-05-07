const express = require("express");
const router = express.Router();
const {
  placeOrder,
  getMyOrders,
  getSingleOrder,
  cancelOrder,
  getAllOrders,
  updateOrderStatus,
} = require("../controllers/order.controller");
const { protect, restrictTo } = require("../middleware/auth.middleware");

// ─── Customer routes ──────────────────────────────────────────────────────────
router.post("/", protect, placeOrder);
router.get("/my", protect, getMyOrders);
router.get("/:id", protect, getSingleOrder);
router.patch("/:id/cancel", protect, cancelOrder);

// ─── Admin routes ─────────────────────────────────────────────────────────────
router.get("/", protect, restrictTo("admin"), getAllOrders);
router.patch("/:id/status", protect, restrictTo("admin"), updateOrderStatus);

module.exports = router;