const express = require("express");
const router = express.Router();
const { register, login, googleAuth } = require("../controllers/auth.controller");
const { protect } = require("../middleware/auth.middleware");
const { upload } = require("../middleware/upload.middleware");

// Public routes
router.post("/register", upload.single("avatar"), register);  // avatar is optional
router.post("/login", login);
router.get("/google", googleAuth);

// Protected route - get current logged in user
router.get("/me", protect, (req, res) => {
  res.status(200).json({ success: true, user: req.user });
});

module.exports = router;
