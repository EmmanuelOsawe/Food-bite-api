const { Review } = require("../models/review.model");
const { Food } = require("../models/food.model");

// ─── CUSTOMER: Create a food review ──────────────────────────────────────────
// POST /api/reviews/food/:foodId

exports.createFoodReview = async (req, res) => {
  try {
    const { rating, title, comment } = req.body;

    if (!rating || !comment) {
      return res.status(400).json({
        success: false,
        message: "Rating and comment are required.",
      });
    }

    const food = await Food.findById(req.params.foodId);
    if (!food) {
      return res.status(404).json({ success: false, message: "Food not found." });
    }

    // Check if customer already reviewed this food
    const existing = await Review.findOne({
      customer: req.user._id,
      food: req.params.foodId,
      type: "food",
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "You have already reviewed this food item. Edit your existing review instead.",
      });
    }

    const review = await Review.create({
      customer: req.user._id,
      type: "food",
      food: req.params.foodId,
      rating: Number(rating),
      title,
      comment,
    });

    await review.populate("customer", "name avatar");

    res.status(201).json({ success: true, review });
  } catch (error) {
    console.error("Create food review error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── CUSTOMER: Create a restaurant review ────────────────────────────────────
// POST /api/reviews/restaurant

exports.createRestaurantReview = async (req, res) => {
  try {
    const { rating, title, comment } = req.body;

    if (!rating || !comment) {
      return res.status(400).json({
        success: false,
        message: "Rating and comment are required.",
      });
    }

    // One restaurant review per customer
    const existing = await Review.findOne({
      customer: req.user._id,
      type: "restaurant",
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "You have already reviewed the restaurant. Edit your existing review instead.",
      });
    }

    const review = await Review.create({
      customer: req.user._id,
      type: "restaurant",
      rating: Number(rating),
      title,
      comment,
    });

    await review.populate("customer", "name avatar");

    res.status(201).json({ success: true, review });
  } catch (error) {
    console.error("Create restaurant review error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── CUSTOMER: Edit own review ────────────────────────────────────────────────
// PUT /api/reviews/:id

exports.editReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found." });
    }

    if (review.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    const { rating, title, comment } = req.body;
    if (rating) review.rating = Number(rating);
    if (title) review.title = title;
    if (comment) review.comment = comment;

    await review.save();
    await review.populate("customer", "name avatar");

    res.status(200).json({ success: true, review });
  } catch (error) {
    console.error("Edit review error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── CUSTOMER: Delete own review ──────────────────────────────────────────────
// DELETE /api/reviews/:id

exports.deleteReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found." });
    }

    const isOwner = review.customer.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    await review.deleteOne();
    res.status(200).json({ success: true, message: "Review deleted." });
  } catch (error) {
    console.error("Delete review error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── PUBLIC: Get all reviews for a food item ──────────────────────────────────
// GET /api/reviews/food/:foodId

exports.getFoodReviews = async (req, res) => {
  try {
    const { page = 1, limit = 10, sort = "-createdAt" } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const total = await Review.countDocuments({
      type: "food",
      food: req.params.foodId,
    });

    const reviews = await Review.find({ type: "food", food: req.params.foodId })
      .populate("customer", "name avatar")
      .sort(sort)
      .skip(skip)
      .limit(Number(limit));

    // Calculate average rating
    const allRatings = await Review.find({ type: "food", food: req.params.foodId }).select("rating");
    const avgRating =
      allRatings.length > 0
        ? Math.round((allRatings.reduce((s, r) => s + r.rating, 0) / allRatings.length) * 10) / 10
        : 0;

    res.status(200).json({
      success: true,
      total,
      averageRating: avgRating,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      reviews,
    });
  } catch (error) {
    console.error("Get food reviews error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── PUBLIC: Get all restaurant reviews ───────────────────────────────────────
// GET /api/reviews/restaurant

exports.getRestaurantReviews = async (req, res) => {
  try {
    const { page = 1, limit = 10, sort = "-createdAt" } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const total = await Review.countDocuments({ type: "restaurant" });

    const reviews = await Review.find({ type: "restaurant" })
      .populate("customer", "name avatar")
      .sort(sort)
      .skip(skip)
      .limit(Number(limit));

    const allRatings = await Review.find({ type: "restaurant" }).select("rating");
    const avgRating =
      allRatings.length > 0
        ? Math.round((allRatings.reduce((s, r) => s + r.rating, 0) / allRatings.length) * 10) / 10
        : 0;

    res.status(200).json({
      success: true,
      total,
      averageRating: avgRating,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      reviews,
    });
  } catch (error) {
    console.error("Get restaurant reviews error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── ADMIN: Reply to a review ─────────────────────────────────────────────────
// PATCH /api/reviews/:id/reply

exports.replyToReview = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, message: "Reply message is required." });
    }

    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { reply: { message, repliedAt: new Date() } },
      { new: true }
    ).populate("customer", "name avatar");

    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found." });
    }

    res.status(200).json({ success: true, review });
  } catch (error) {
    console.error("Reply to review error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
