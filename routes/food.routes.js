const express = require("express");
const router = express.Router();
const {
  addFood,
  updateFood,
  deleteFood,
  toggleAvailability,
  getAllFoods,
  getSingleFood,
  rateFood,
} = require("../controllers/food.controller");
const { protect, restrictTo } = require("../middleware/auth.middleware");
const { upload } = require("../middleware/upload.middleware");

// ─── Public routes ────────────────────────────────────────────────────────────
router.get("/", getAllFoods);
router.get("/:id", getSingleFood);

// ─── Customer routes (must be logged in) ─────────────────────────────────────
router.post("/:id/rate", protect, rateFood);

// ─── Admin only routes ────────────────────────────────────────────────────────
router.post("/", protect, restrictTo("admin"), upload.single("image"), addFood);
router.put("/:id", protect, restrictTo("admin"), upload.single("image"), updateFood);
router.patch("/:id/availability", protect, restrictTo("admin"), toggleAvailability);
router.delete("/:id", protect, restrictTo("admin"), deleteFood);

module.exports = router;