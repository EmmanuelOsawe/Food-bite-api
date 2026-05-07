const mongoose = require("mongoose");

const ratingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    review: { type: String, trim: true },
  },
  { timestamps: true }
);

const foodSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Food name is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      enum: ["breakfast", "lunch", "dinner", "drinks", "desserts", "snacks", "sides"],
      lowercase: true,
    },
    image: {
      url: { type: String, default: null },
      public_id: { type: String, default: null }, // for Cloudinary deletion
    },
    ingredients: {
      type: [String],
      default: [],
    },
    prepTime: {
      type: Number, // in minutes
      required: [true, "Prep time is required"],
      min: 1,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    ratings: [ratingSchema],
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalRatings: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// Auto-recalculate averageRating & totalRatings when ratings change
foodSchema.methods.recalculateRatings = function () {
  if (this.ratings.length === 0) {
    this.averageRating = 0;
    this.totalRatings = 0;
  } else {
    const sum = this.ratings.reduce((acc, r) => acc + r.rating, 0);
    this.averageRating = Math.round((sum / this.ratings.length) * 10) / 10;
    this.totalRatings = this.ratings.length;
  }
};

// Text index for search
foodSchema.index({ name: "text", description: "text", ingredients: "text" });

const Food = mongoose.model("Food", foodSchema);
module.exports = { Food };
