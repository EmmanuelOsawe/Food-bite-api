const nodemailer = require("nodemailer");
const twilio = require("twilio");

// ─── Email Setup (Nodemailer) ─────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // use Gmail App Password
  },
});

// ─── SMS Setup (Twilio) ───────────────────────────────────────────────────────
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// ─── Send Email ───────────────────────────────────────────────────────────────
const sendEmail = async ({ to, subject, html }) => {
  try {
    await transporter.sendMail({
      from: `"Food Bite Restaurant" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
    console.log(`✅ Email sent to ${to}`);
  } catch (err) {
    console.error("Email error:", err.message);
  }
};

// ─── Send SMS ─────────────────────────────────────────────────────────────────
const sendSMS = async ({ to, message }) => {
  try {
    await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to,
    });
    console.log(`✅ SMS sent to ${to}`);
  } catch (err) {
    console.error("SMS error:", err.message);
  }
};

// ─── Notification Templates ───────────────────────────────────────────────────

// Reservation confirmed
const sendReservationNotification = async ({ name, email, phone, date, time, guests }) => {
  const formattedDate = new Date(date).toLocaleDateString("en-NG", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  await sendEmail({
    to: email,
    subject: "Your Table Reservation — Food Bite Restaurant",
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:2rem;background:#fdf6ec;border-radius:12px">
        <img src="cid:logo" style="height:48px;margin-bottom:1rem" />
        <h2 style="color:#3B1F0A;margin-bottom:0.5rem">Reservation Confirmed! 🎉</h2>
        <p style="color:#666">Hi <strong>${name}</strong>, your table has been reserved.</p>
        <div style="background:white;border-radius:8px;padding:1.25rem;margin:1.25rem 0;border-left:4px solid #D47C2F">
          <p style="margin:0 0 8px"><strong>📅 Date:</strong> ${formattedDate}</p>
          <p style="margin:0 0 8px"><strong>🕐 Time:</strong> ${time}</p>
          <p style="margin:0"><strong>👥 Guests:</strong> ${guests}</p>
        </div>
        <p style="color:#666;font-size:0.9rem">We look forward to welcoming you! If you need to cancel or modify your reservation, please contact us at least 2 hours before your booking time.</p>
        <p style="color:#666;font-size:0.9rem">📞 +234 801 234 5678 | ✉ hello@foodbite.ng</p>
        <hr style="border:none;border-top:1px solid #eee;margin:1.5rem 0"/>
        <p style="color:#aaa;font-size:0.8rem;text-align:center">Food Bite Restaurant · Lagos, Nigeria</p>
      </div>
    `,
  });

  if (phone) {
    await sendSMS({
      to: phone,
      message: `Hi ${name}! Your Food Bite table reservation is confirmed for ${formattedDate} at ${time} for ${guests} guest(s). See you soon! Call us: +234 801 234 5678`,
    });
  }
};

// Order confirmed
const sendOrderNotification = async ({ name, email, phone, orderId, items, total, status }) => {
  const statusMessages = {
    confirmed: { emoji: "✅", text: "Your order has been confirmed and is being prepared!" },
    preparing: { emoji: "👨‍🍳", text: "Our chefs are preparing your order right now." },
    ready: { emoji: "🍽", text: "Your order is ready and on its way to you!" },
    delivered: { emoji: "🎉", text: "Your order has been delivered. Enjoy your meal!" },
    cancelled: { emoji: "❌", text: "Your order has been cancelled." },
  };

  const { emoji, text } = statusMessages[status] || statusMessages.confirmed;
  const itemsList = items.map(i => `<li>${i.name} × ${i.quantity} — ₦${Number(i.subtotal).toLocaleString()}</li>`).join("");
  const shortId = orderId.toString().slice(-8).toUpperCase();

  await sendEmail({
    to: email,
    subject: `Order ${shortId} — ${status.charAt(0).toUpperCase() + status.slice(1)} | Food Bite`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:2rem;background:#fdf6ec;border-radius:12px">
        <h2 style="color:#3B1F0A">${emoji} Order Update</h2>
        <p style="color:#666">Hi <strong>${name}</strong>, ${text}</p>
        <div style="background:white;border-radius:8px;padding:1.25rem;margin:1.25rem 0;border-left:4px solid #D47C2F">
          <p style="margin:0 0 8px"><strong>Order ID:</strong> #${shortId}</p>
          <ul style="margin:8px 0;padding-left:1.25rem;color:#555">${itemsList}</ul>
          <p style="margin:8px 0 0;font-weight:700;font-size:1.1rem">Total: ₦${Number(total).toLocaleString()}</p>
        </div>
        <p style="color:#666;font-size:0.9rem">Questions? Contact us at hello@foodbite.ng or +234 801 234 5678</p>
        <hr style="border:none;border-top:1px solid #eee;margin:1.5rem 0"/>
        <p style="color:#aaa;font-size:0.8rem;text-align:center">Food Bite Restaurant · Lagos, Nigeria</p>
      </div>
    `,
  });

  if (phone) {
    await sendSMS({
      to: phone,
      message: `Food Bite: ${emoji} Order #${shortId} — ${text} Total: ₦${Number(total).toLocaleString()}. Questions? Call +234 801 234 5678`,
    });
  }
};

module.exports = { sendEmail, sendSMS, sendReservationNotification, sendOrderNotification };