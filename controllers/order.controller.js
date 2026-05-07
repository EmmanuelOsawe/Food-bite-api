const { Order } = require("../models/order.model");
const { Food } = require("../models/food.model");

// ─── CUSTOMER: Place order ────────────────────────────────────────────────────
// POST /api/orders

exports.placeOrder = async (req, res) => {
  try {
    const { items, deliveryAddress, note } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Order must contain at least one item.",
      });
    }

    if (!deliveryAddress) {
      return res.status(400).json({
        success: false,
        message: "Delivery address is required.",
      });
    }

    // Validate each item and build order items with price snapshots
    const orderItems = [];
    let totalAmount = 0;

    for (const item of items) {
      const food = await Food.findById(item.foodId);

      if (!food) {
        return res.status(404).json({
          success: false,
          message: `Food item with id ${item.foodId} not found.`,
        });
      }

      if (!food.isAvailable) {
        return res.status(400).json({
          success: false,
          message: `"${food.name}" is currently out of stock.`,
        });
      }

      if (!item.quantity || item.quantity < 1) {
        return res.status(400).json({
          success: false,
          message: `Invalid quantity for "${food.name}".`,
        });
      }

      const subtotal = food.price * item.quantity;
      totalAmount += subtotal;

      orderItems.push({
        food: food._id,
        name: food.name,       // snapshot
        price: food.price,     // snapshot
        quantity: item.quantity,
        subtotal,
      });
    }

    const order = await Order.create({
      customer: req.user._id,
      items: orderItems,
      totalAmount,
      deliveryAddress,
      note: note || null,
    });

    res.status(201).json({ success: true, order });
  } catch (error) {
    console.error("Place order error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── CUSTOMER: Get my orders ──────────────────────────────────────────────────
// GET /api/orders/my

exports.getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ customer: req.user._id })
      .populate("items.food", "name image category")
      .sort("-createdAt");

    res.status(200).json({ success: true, total: orders.length, orders });
  } catch (error) {
    console.error("Get my orders error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── CUSTOMER: Get single order ───────────────────────────────────────────────
// GET /api/orders/:id

exports.getSingleOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate(
      "items.food",
      "name image category"
    );

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    // Customers can only view their own orders
    if (order.customer.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    res.status(200).json({ success: true, order });
  } catch (error) {
    console.error("Get order error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── CUSTOMER: Cancel order ───────────────────────────────────────────────────
// PATCH /api/orders/:id/cancel

exports.cancelOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    if (order.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    if (!["pending", "confirmed"].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Order cannot be cancelled. Current status: ${order.status}.`,
      });
    }

    order.status = "cancelled";
    await order.save();

    res.status(200).json({ success: true, message: "Order cancelled.", order });
  } catch (error) {
    console.error("Cancel order error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── ADMIN: Get all orders ────────────────────────────────────────────────────
// GET /api/orders

exports.getAllOrders = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const query = status ? { status } : {};
    const skip = (Number(page) - 1) * Number(limit);

    const total = await Order.countDocuments(query);
    const orders = await Order.find(query)
      .populate("customer", "name email avatar")
      .populate("items.food", "name image")
      .sort("-createdAt")
      .skip(skip)
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      orders,
    });
  } catch (error) {
    console.error("Get all orders error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── ADMIN: Update order status ───────────────────────────────────────────────
// PATCH /api/orders/:id/status

exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ["pending", "confirmed", "preparing", "ready", "delivered", "cancelled"];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${validStatuses.join(", ")}.`,
      });
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate("customer", "name email");

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    res.status(200).json({ success: true, message: `Order status updated to "${status}".`, order });
  } catch (error) {
    console.error("Update order status error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};