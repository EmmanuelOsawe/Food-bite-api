const { ContactMessage } = require("../models/contactMessage.model");

// ─── PUBLIC: Send a contact message ──────────────────────────────────────────
// POST /api/contact

exports.sendMessage = async (req, res) => {
  try {
    const { name, phone, email, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: "Name, email and message are required.",
      });
    }

    const contact = await ContactMessage.create({ name, phone, email, message });

    res.status(201).json({
      success: true,
      message: "Message received! We will get back to you shortly.",
      contact,
    });
  } catch (error) {
    console.error("Contact message error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── ADMIN: Get all messages ──────────────────────────────────────────────────
// GET /api/contact

exports.getAllMessages = async (req, res) => {
  try {
    const { isRead, page = 1, limit = 20 } = req.query;
    const query = {};
    if (isRead !== undefined) query.isRead = isRead === "true";

    const skip = (Number(page) - 1) * Number(limit);
    const total = await ContactMessage.countDocuments(query);
    const messages = await ContactMessage.find(query)
      .sort("-createdAt")
      .skip(skip)
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      total,
      unread: await ContactMessage.countDocuments({ isRead: false }),
      messages,
    });
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── ADMIN: Mark message as read ─────────────────────────────────────────────
// PATCH /api/contact/:id/read

exports.markAsRead = async (req, res) => {
  try {
    const message = await ContactMessage.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found." });
    }

    res.status(200).json({ success: true, message });
  } catch (error) {
    console.error("Mark read error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── ADMIN: Delete message ────────────────────────────────────────────────────
// DELETE /api/contact/:id

exports.deleteMessage = async (req, res) => {
  try {
    const message = await ContactMessage.findByIdAndDelete(req.params.id);

    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found." });
    }

    res.status(200).json({ success: true, message: "Message deleted." });
  } catch (error) {
    console.error("Delete message error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
