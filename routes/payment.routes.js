const express = require("express");
const router = express.Router();
const {
  initializePayment,
  verifyPayment,
  paystackWebhook,
  refundPayment,
  getMyPayments,
  getAllPayments,
} = require("../controllers/payment.controller");
const { protect, restrictTo } = require("../middleware/auth.middleware");

// ─── Paystack webhook ─────────────────────────────────────────────────────────
// IMPORTANT: must use express.raw() here — Paystack sends raw body for signature
// This route must be defined BEFORE express.json() processes it in app.js
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  paystackWebhook
);

// ─── Paystack redirect after payment ─────────────────────────────────────────
// No auth — Paystack hits this URL directly
router.get("/verify/:reference", verifyPayment);

// ─── Customer routes ──────────────────────────────────────────────────────────
router.post("/initialize/:orderId", protect, initializePayment);
router.post("/refund/:orderId", protect, refundPayment);
router.get("/my", protect, getMyPayments);

// ─── Admin routes ─────────────────────────────────────────────────────────────
router.get("/", protect, restrictTo("admin"), getAllPayments);

module.exports = router;
