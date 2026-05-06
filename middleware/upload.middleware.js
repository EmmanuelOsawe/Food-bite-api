const multer = require("multer");
const { cloudinary } = require("../config/cloudinary.config");
const { Readable } = require("stream");

// Use memory storage — we stream the buffer directly to Cloudinary
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPEG, PNG and WEBP images are allowed."), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
});

/**
 * Uploads a buffer to Cloudinary and returns { url, public_id }
 */
const uploadToCloudinary = (buffer, folder = "food-bite/avatars") => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (error, result) => {
        if (error) return reject(error);
        resolve({ url: result.secure_url, public_id: result.public_id });
      }
    );
    Readable.from(buffer).pipe(uploadStream);
  });
};

module.exports = { upload, uploadToCloudinary };