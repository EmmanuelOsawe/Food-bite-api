const mongoose = require("mongoose");

const pushSubscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    subscription: {
      endpoint: { type: String, required: true },
      keys: {
        p256dh: { type: String, required: true },
        auth: { type: String, required: true },
      },
    },
  },
  { timestamps: true }
);

// One subscription per user (upsert on save)
pushSubscriptionSchema.index({ user: 1 }, { unique: true });

const PushSubscription = mongoose.model("PushSubscription", pushSubscriptionSchema);
module.exports = { PushSubscription };
