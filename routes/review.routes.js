const express = require("express");
const router = express.Router();
const {
  createFoodReview,
  createRestaurantReview,
  editReview,
  deleteReview,
  getFoodReviews,
  getRestaurantReviews,
  replyToReview,
} = require("../controllers/review.controller");
const { protect, restrictTo } = require("../middleware/auth.middleware");

// ─── Public routes ────────────────────────────────────────────────────────────
router.get("/food/:foodId", getFoodReviews);
router.get("/restaurant", getRestaurantReviews);

// ─── Customer routes ──────────────────────────────────────────────────────────
router.post("/food/:foodId", protect, createFoodReview);
router.post("/restaurant", protect, createRestaurantReview);
router.put("/:id", protect, editReview);
router.delete("/:id", protect, deleteReview);

// ─── Admin routes ─────────────────────────────────────────────────────────────
router.patch("/:id/reply", protect, restrictTo("admin"), replyToReview);

module.exports = router;
