const { Reservation } = require("../models/reservation.model");

// ─── CUSTOMER: Make a reservation ─────────────────────────────────────────────
// POST /api/reservations

exports.createReservation = async (req, res) => {
  try {
    const { date, time, guests } = req.body;

    if (!date || !time || !guests) {
      return res.status(400).json({
        success: false,
        message: "Date, time and number of guests are required.",
      });
    }

    // Prevent reservations in the past
    const reservationDate = new Date(`${date}T${time}`);
    if (reservationDate < new Date()) {
      return res.status(400).json({
        success: false,
        message: "Reservation date and time cannot be in the past.",
      });
    }

    const reservation = await Reservation.create({
      customer: req.user._id,
      date: new Date(date),
      time,
      guests: Number(guests),
    });

    res.status(201).json({ success: true, reservation });
  } catch (error) {
    console.error("Create reservation error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── CUSTOMER: Get my reservations ────────────────────────────────────────────
// GET /api/reservations/my

exports.getMyReservations = async (req, res) => {
  try {
    const reservations = await Reservation.find({ customer: req.user._id }).sort(
      "-date"
    );
    res.status(200).json({ success: true, total: reservations.length, reservations });
  } catch (error) {
    console.error("Get my reservations error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── CUSTOMER: Cancel a reservation ──────────────────────────────────────────
// PATCH /api/reservations/:id/cancel

exports.cancelReservation = async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id);

    if (!reservation) {
      return res.status(404).json({ success: false, message: "Reservation not found." });
    }

    if (reservation.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    if (["cancelled", "completed"].includes(reservation.status)) {
      return res.status(400).json({
        success: false,
        message: `Reservation is already ${reservation.status}.`,
      });
    }

    reservation.status = "cancelled";
    await reservation.save();

    res.status(200).json({ success: true, message: "Reservation cancelled.", reservation });
  } catch (error) {
    console.error("Cancel reservation error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── ADMIN: Get all reservations ──────────────────────────────────────────────
// GET /api/reservations

exports.getAllReservations = async (req, res) => {
  try {
    const { status, date, page = 1, limit = 10 } = req.query;
    const query = {};

    if (status) query.status = status;
    if (date) {
      const start = new Date(date);
      const end = new Date(date);
      end.setDate(end.getDate() + 1);
      query.date = { $gte: start, $lt: end };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Reservation.countDocuments(query);

    const reservations = await Reservation.find(query)
      .populate("customer", "name email")
      .sort("date")
      .skip(skip)
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      reservations,
    });
  } catch (error) {
    console.error("Get all reservations error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── ADMIN: Update reservation status ────────────────────────────────────────
// PATCH /api/reservations/:id/status

exports.updateReservationStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ["pending", "confirmed", "cancelled", "completed"];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${validStatuses.join(", ")}.`,
      });
    }

    const reservation = await Reservation.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate("customer", "name email");

    if (!reservation) {
      return res.status(404).json({ success: false, message: "Reservation not found." });
    }

    res.status(200).json({
      success: true,
      message: `Reservation status updated to "${status}".`,
      reservation,
    });
  } catch (error) {
    console.error("Update reservation status error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
