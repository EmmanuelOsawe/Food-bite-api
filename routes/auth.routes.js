const express = require("express");
const router = express.Router();
const { register, login, googleAuth } = require("../controllers/auth.controller");
const { protect } = require("../middleware/auth.middleware");
const { upload } = require("../middleware/upload.middleware");

// Email/Password
router.post("/register", upload.single("avatar"), register);
router.post("/login", login);

// Google — original approach (frontend sends Google ID token)
router.get("/google", googleAuth);

// Protected
router.get("/me", protect, (req, res) => {
  res.status(200).json({ success: true, user: req.user });
});

module.exports = router;