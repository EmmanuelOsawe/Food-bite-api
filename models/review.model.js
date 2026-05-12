const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["food", "restaurant"],
      required: true,
    },
    // Only set when type is "food"
    food: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Food",
      default: null,
    },
    rating: {
      type: Number,
      required: [true, "Rating is required"],
      min: 1,
      max: 5,
    },
    title: {
      type: String,
      trim: true,
      maxlength: [100, "Title cannot exceed 100 characters"],
    },
    comment: {
      type: String,
      required: [true, "Review comment is required"],
      trim: true,
      maxlength: [1000, "Comment cannot exceed 1000 characters"],
    },
    // Admin can reply to a review
    reply: {
      message: { type: String, default: null },
      repliedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

// One review per customer per food item
reviewSchema.index({ customer: 1, food: 1 }, { unique: true, sparse: true });

// One restaurant review per customer
reviewSchema.index(
  { customer: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: { type: "restaurant" },
  }
);

const Review = mongoose.model("Review", reviewSchema);
module.exports = { Review };
