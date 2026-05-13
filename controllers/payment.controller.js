const axios = require("axios");
const crypto = require("crypto");
const { Payment } = require("../models/payment.model");
const { Order } = require("../models/order.model");

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE = "https://api.paystack.co";

// ─── Helper: generate unique payment reference ────────────────────────────────
const generateReference = () =>
  `FOODBITE-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

// ─── CUSTOMER: Initialize payment ────────────────────────────────────────────
// POST /api/payments/initialize/:orderId
// Creates a Paystack payment session and returns an authorization_url
// Customer is redirected to that URL to complete payment

exports.initializePayment = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    if (order.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    if (order.paymentStatus === "paid") {
      return res.status(400).json({ success: false, message: "This order is already paid." });
    }

    const reference = generateReference();
    const amountInKobo = order.totalAmount * 100; // Paystack requires kobo

    // Call Paystack to initialize transaction
    const response = await axios.post(
      `${PAYSTACK_BASE}/transaction/initialize`,
      {
        email: req.user.email,
        amount: amountInKobo,
        reference,
        callback_url: `${process.env.SERVER_URL}/api/payments/verify/${reference}`,
        metadata: {
          orderId: order._id.toString(),
          customerId: req.user._id.toString(),
          customerName: req.user.name,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
          "Content-Type": "application/json",
        },
      }
    );

    const { authorization_url, access_code } = response.data.data;

    // Save pending payment record
    await Payment.create({
      order: order._id,
      customer: req.user._id,
      email: req.user.email,
      amount: amountInKobo,
      reference,
      status: "pending",
    });

    // Save reference on the order
    order.paymentReference = reference;
    await order.save();

    res.status(200).json({
      success: true,
      message: "Payment initialized. Redirect customer to the authorization_url.",
      authorization_url,   // frontend redirects user here to pay
      access_code,
      reference,
    });
  } catch (error) {
    console.error("Initialize payment error:", error?.response?.data || error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── PAYSTACK: Verify payment after redirect ──────────────────────────────────
// GET /api/payments/verify/:reference
// Paystack redirects here after customer pays (callback_url)

exports.verifyPayment = async (req, res) => {
  try {
    const { reference } = req.params;

    // Ask Paystack to confirm the transaction
    const response = await axios.get(
      `${PAYSTACK_BASE}/transaction/verify/${reference}`,
      {
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
      }
    );

    const paystackData = response.data.data;
    const payment = await Payment.findOne({ reference });

    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment record not found." });
    }

    if (paystackData.status === "success") {
      // Update payment record
      payment.status = "success";
      payment.paystackData = paystackData;
      await payment.save();

      // Update order payment status
      await Order.findByIdAndUpdate(payment.order, {
        paymentStatus: "paid",
        status: "confirmed", // auto-confirm order on successful payment
      });

      // Redirect to frontend success page
      return res.redirect(
        `${process.env.CLIENT_URL}/payment/success?reference=${reference}`
      );
    } else {
      payment.status = "failed";
      payment.paystackData = paystackData;
      await payment.save();

      return res.redirect(
        `${process.env.CLIENT_URL}/payment/failed?reference=${reference}`
      );
    }
  } catch (error) {
    console.error("Verify payment error:", error?.response?.data || error);
    res.redirect(`${process.env.CLIENT_URL}/payment/failed`);
  }
};

// ─── PAYSTACK: Webhook ────────────────────────────────────────────────────────
// POST /api/payments/webhook
// Paystack calls this server-to-server to confirm events (most reliable method)
// Set this URL in your Paystack dashboard under Settings → Webhooks

exports.paystackWebhook = async (req, res) => {
  try {
    // Verify the event is actually from Paystack using signature
    const hash = crypto
      .createHmac("sha512", PAYSTACK_SECRET)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (hash !== req.headers["x-paystack-signature"]) {
      return res.status(401).json({ message: "Invalid signature." });
    }

    const event = req.body;

    if (event.event === "charge.success") {
      const { reference, metadata } = event.data;

      const payment = await Payment.findOne({ reference });
      if (payment && payment.status !== "success") {
        payment.status = "success";
        payment.paystackData = event.data;
        await payment.save();

        await Order.findByIdAndUpdate(metadata.orderId, {
          paymentStatus: "paid",
          status: "confirmed",
        });

        console.log(`✅ Webhook: payment ${reference} confirmed for order ${metadata.orderId}`);
      }
    }

    // Always respond 200 quickly — Paystack retries if you don't
    res.sendStatus(200);
  } catch (error) {
    console.error("Webhook error:", error);
    res.sendStatus(500);
  }
};

// ─── CUSTOMER: Request refund on order cancellation ───────────────────────────
// POST /api/payments/refund/:orderId

exports.refundPayment = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    if (order.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    if (order.paymentStatus !== "paid") {
      return res.status(400).json({
        success: false,
        message: "This order has no successful payment to refund.",
      });
    }

    if (!["pending", "confirmed"].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Order cannot be refunded. Current status: "${order.status}". Only pending or confirmed orders can be refunded.`,
      });
    }

    const payment = await Payment.findOne({
      order: order._id,
      status: "success",
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment record not found." });
    }

    // Call Paystack refund API
    const response = await axios.post(
      `${PAYSTACK_BASE}/refund`,
      {
        transaction: payment.reference,
        amount: payment.amount, // full refund in kobo
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.status) {
      // Update payment and order
      payment.status = "refunded";
      payment.refundedAt = new Date();
      await payment.save();

      order.status = "cancelled";
      order.paymentStatus = "refunded";
      await order.save();

      return res.status(200).json({
        success: true,
        message: "Refund initiated successfully. It may take 3-5 business days to reflect.",
        refund: response.data.data,
      });
    }

    res.status(400).json({ success: false, message: "Refund could not be processed." });
  } catch (error) {
    console.error("Refund error:", error?.response?.data || error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── CUSTOMER: Get my payment history ────────────────────────────────────────
// GET /api/payments/my

exports.getMyPayments = async (req, res) => {
  try {
    const payments = await Payment.find({ customer: req.user._id })
      .populate("order", "items totalAmount status deliveryAddress")
      .sort("-createdAt");

    res.status(200).json({ success: true, total: payments.length, payments });
  } catch (error) {
    console.error("Get my payments error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── ADMIN: Get all payments ──────────────────────────────────────────────────
// GET /api/payments

exports.getAllPayments = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const query = status ? { status } : {};
    const skip = (Number(page) - 1) * Number(limit);

    const total = await Payment.countDocuments(query);
    const payments = await Payment.find(query)
      .populate("customer", "name email")
      .populate("order", "items totalAmount status")
      .sort("-createdAt")
      .skip(skip)
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      payments,
    });
  } catch (error) {
    console.error("Get all payments error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
