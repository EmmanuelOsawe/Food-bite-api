const express = require("express");
const router = express.Router();
const { register, login, googleAuth } = require("../controllers/auth.controller");
const { protect } = require("../middleware/auth.middleware");

// Public routes
router.post("/register", register);
router.post("/login", login);
router.get("/google", googleAuth);

// Example protected route (e.g. get current user)
router.get("/me", protect, (req, res) => {
  res.status(200).json({ success: true, user: req.user });
});

module.exports = router;
