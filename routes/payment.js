const express = require("express");
const router = express.Router();
const razorpay = require("../utils/razorpay");
const crypto = require("crypto");

router.post("/create-order", async (req, res) => {
  const { amount, currency } = req.body;

  const options = {
    amount: amount * 100,
    currency,
    receipt: `receipt_${Date.now()}`,
  };

  try {
    const order = await razorpay.orders.create(options);
    res.json({ success: true, order });
  } catch (error) {
    res.status(500).json({ success: false, error });
  }
});

router.post("/verify", (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    req.body;

  const body = razorpay_order_id + "|" + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body.toString())
    .digest("hex");

  const isAuthentic = expectedSignature === razorpay_signature;

  if (isAuthentic) {
    res.json({ success: true, message: "Payment verified successfully" });
  } else {
    res.status(400).json({ success: false, message: "Invalid signature" });
  }
});

router.get("/payments-by-email", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Email is required" });
    }

    const payments = await Payment.find({ email }).sort({ created_at: -1 });
    if (!payments.length) {
      return res
        .status(404)
        .json({ success: false, message: "No payments found for this email" });
    }

    res.status(200).json({ success: true, count: payments.length, payments });
  } catch (error) {
    console.error("Error fetching payments:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/transactions", async (req, res) => {
  try {
    const response = await axios.get("https://api.razorpay.com/v1/payments", {
      auth: {
        username: process.env.RAZORPAY_KEY_ID,
        password: process.env.RAZORPAY_KEY_SECRET,
      },
    });

    const uniquePayments = Array.from(
      new Map(response.data.items.map((item) => [item.id, item])).values()
    );

    res.json({
      entity: "collection",
      count: uniquePayments.length,
      items: uniquePayments,
    });
  } catch (error) {
    console.error("Error fetching Razorpay payments:", error.message);
    res
      .status(error.response?.status || 500)
      .json({ error: "Failed to fetch payments" });
  }
});

module.exports = router;
