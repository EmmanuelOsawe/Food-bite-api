const { Food } = require("../models/food.model");
const { cloudinary } = require("../config/cloudinary.config");
const { uploadToCloudinary } = require("../middleware/upload.middleware");
const { broadcastNewFood } = require("./notification.controller");

// ─── ADMIN: Add food ─────────────────────────────────────────────────────────
// POST /api/foods

exports.addFood = async (req, res) => {
  try {
    const { name, description, price, category, ingredients, prepTime } = req.body;

    if (!name || !description || !price || !category || !prepTime) {
      return res.status(400).json({
        success: false,
        message: "Name, description, price, category and prepTime are required.",
      });
    }

    let image = { url: null, public_id: null };
    if (req.file) {
      const uploaded = await uploadToCloudinary(req.file.buffer, "food-bite/foods");
      image = { url: uploaded.url, public_id: uploaded.public_id };
    }

    // ingredients can be sent as a comma-separated string or JSON array
    let parsedIngredients = [];
    if (ingredients) {
      parsedIngredients = Array.isArray(ingredients)
        ? ingredients
        : ingredients.split(",").map((i) => i.trim());
    }

    const food = await Food.create({
      name,
      description,
      price: Number(price),
      category: category.toLowerCase(),
      ingredients: parsedIngredients,
      prepTime: Number(prepTime),
      image,
      createdBy: req.user._id,
    });

    // Broadcast real-time + push notification to all users
    broadcastNewFood(food).catch(console.error);

    res.status(201).json({ success: true, food });
  } catch (error) {
    console.error("Add food error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── ADMIN: Update food ───────────────────────────────────────────────────────
// PUT /api/foods/:id

exports.updateFood = async (req, res) => {
  try {
    const food = await Food.findById(req.params.id);
    if (!food) {
      return res.status(404).json({ success: false, message: "Food not found." });
    }

    const { name, description, price, category, ingredients, prepTime } = req.body;

    if (name) food.name = name;
    if (description) food.description = description;
    if (price) food.price = Number(price);
    if (category) food.category = category.toLowerCase();
    if (prepTime) food.prepTime = Number(prepTime);
    if (ingredients) {
      food.ingredients = Array.isArray(ingredients)
        ? ingredients
        : ingredients.split(",").map((i) => i.trim());
    }

    // Replace image if a new file is uploaded
    if (req.file) {
      // Delete old image from Cloudinary if it exists
      if (food.image?.public_id) {
        await cloudinary.uploader.destroy(food.image.public_id);
      }
      const uploaded = await uploadToCloudinary(req.file.buffer, "food-bite/foods");
      food.image = { url: uploaded.url, public_id: uploaded.public_id };
    }

    await food.save();
    res.status(200).json({ success: true, food });
  } catch (error) {
    console.error("Update food error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── ADMIN: Toggle availability ───────────────────────────────────────────────
// PATCH /api/foods/:id/availability

exports.toggleAvailability = async (req, res) => {
  try {
    const food = await Food.findById(req.params.id);
    if (!food) {
      return res.status(404).json({ success: false, message: "Food not found." });
    }

    food.isAvailable = !food.isAvailable;
    await food.save();

    res.status(200).json({
      success: true,
      message: `${food.name} is now ${food.isAvailable ? "available" : "out of stock"}.`,
      isAvailable: food.isAvailable,
    });
  } catch (error) {
    console.error("Toggle availability error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── ADMIN: Delete food ───────────────────────────────────────────────────────
// DELETE /api/foods/:id

exports.deleteFood = async (req, res) => {
  try {
    const food = await Food.findById(req.params.id);
    if (!food) {
      return res.status(404).json({ success: false, message: "Food not found." });
    }

    // Remove image from Cloudinary
    if (food.image?.public_id) {
      await cloudinary.uploader.destroy(food.image.public_id);
    }

    await food.deleteOne();
    res.status(200).json({ success: true, message: `${food.name} has been deleted.` });
  } catch (error) {
    console.error("Delete food error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── CUSTOMER: Get all foods (filter + search + pagination) ──────────────────
// GET /api/foods
// Query params: category, available, search, page, limit, minPrice, maxPrice, sort

exports.getAllFoods = async (req, res) => {
  try {
    const {
      category,
      available,
      search,
      page = 1,
      limit = 10,
      minPrice,
      maxPrice,
      sort = "-createdAt",
    } = req.query;

    const query = {};

    // Filter by category
    if (category) query.category = category.toLowerCase();

    // Filter by availability
    if (available !== undefined) query.isAvailable = available === "true";

    // Filter by price range
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    // Full-text search (uses the text index on name, description, ingredients)
    if (search) query.$text = { $search: search };

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Food.countDocuments(query);

    const foods = await Food.find(query)
      .sort(sort)
      .skip(skip)
      .limit(Number(limit))
      .select("-ratings"); // exclude individual ratings array for performance

    res.status(200).json({
      success: true,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      foods: foods.map((f) => ({
        ...f.toObject(),
        status: f.isAvailable ? "available" : "out of stock",
      })),
    });
  } catch (error) {
    console.error("Get foods error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── CUSTOMER: Get single food ────────────────────────────────────────────────
// GET /api/foods/:id

exports.getSingleFood = async (req, res) => {
  try {
    const food = await Food.findById(req.params.id).populate(
      "ratings.user",
      "name avatar"
    );

    if (!food) {
      return res.status(404).json({ success: false, message: "Food not found." });
    }

    res.status(200).json({
      success: true,
      food: {
        ...food.toObject(),
        status: food.isAvailable ? "available" : "out of stock",
      },
    });
  } catch (error) {
    console.error("Get food error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── CUSTOMER: Rate a food ────────────────────────────────────────────────────
// POST /api/foods/:id/rate

exports.rateFood = async (req, res) => {
  try {
    const { rating, review } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be a number between 1 and 5.",
      });
    }

    const food = await Food.findById(req.params.id);
    if (!food) {
      return res.status(404).json({ success: false, message: "Food not found." });
    }

    // Check if user already rated this food — update if so
    const existingIndex = food.ratings.findIndex(
      (r) => r.user.toString() === req.user._id.toString()
    );

    if (existingIndex !== -1) {
      food.ratings[existingIndex].rating = rating;
      food.ratings[existingIndex].review = review || "";
    } else {
      food.ratings.push({ user: req.user._id, rating, review: review || "" });
    }

    food.recalculateRatings();
    await food.save();

    res.status(200).json({
      success: true,
      message: "Rating submitted.",
      averageRating: food.averageRating,
      totalRatings: food.totalRatings,
    });
  } catch (error) {
    console.error("Rate food error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};