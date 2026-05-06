const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { OAuth2Client } = require("google-auth-library");
const { User } = require("../models/user.model");
const { uploadToCloudinary } = require("../middleware/upload.middleware");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ─── Helpers ────────────────────────────────────────────────────────────────

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

const sendTokenResponse = (user, statusCode, res) => {
  const token = signToken(user._id);

  const { password, __v, ...userObj } = user.toObject
    ? user.toObject()
    : JSON.parse(JSON.stringify(user));

  res.status(statusCode).json({
    success: true,
    token,
    user: userObj,
  });
};

// ─── POST /api/auth/register ─────────────────────────────────────────────────

exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required.",
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    // Upload avatar to Cloudinary if a file was attached
    let avatarUrl = null;
    if (req.file) {
      const uploaded = await uploadToCloudinary(req.file.buffer);
      avatarUrl = uploaded.url;
    }

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role: role || "customer",
      avatar: avatarUrl,
    });

    sendTokenResponse(user, 201, res);
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── POST /api/auth/login ────────────────────────────────────────────────────

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    sendTokenResponse(user, 200, res);
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET /api/auth/google ────────────────────────────────────────────────────

exports.googleAuth = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Google ID token is required as a query parameter.",
      });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const { name, email, picture, sub: googleId } = ticket.getPayload();

    let user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      user = await User.create({
        name,
        email: email.toLowerCase(),
        googleId,
        avatar: picture,
        role: "customer",
        password: undefined,
      });
    } else if (!user.googleId) {
      user.googleId = googleId;
      if (!user.avatar) user.avatar = picture;
      await user.save({ validateBeforeSave: false });
    }

    sendTokenResponse(user, 200, res);
  } catch (error) {
    console.error("Google auth error:", error);
    if (error.message?.includes("Token used too late")) {
      return res.status(401).json({ success: false, message: "Google token expired." });
    }
    res.status(401).json({ success: false, message: "Google authentication failed." });
  }
};
