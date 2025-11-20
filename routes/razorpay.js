// routes/razorpay.js
import express from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import Reminder from "../models/reminder.js";

const router = express.Router();

// ✅ Initialize Razorpay instance
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ✅ Route 1: Create an order
router.post("/create-order", async (req, res) => {
    try {
        const { amount, reminderId } = req.body;

        const options = {
            amount: amount * 100, // amount in paise
            currency: "INR",
            receipt: `receipt_${reminderId}`,
        };

        const order = await razorpay.orders.create(options);
        res.status(200).json({ success: true, order });
    } catch (error) {
        console.error("❌ Razorpay order creation failed:", error);
        res.status(500).json({ success: false, message: "Failed to create Razorpay order" });
    }
});

// ✅ Route 2: Verify payment signature
router.post("/verify", async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, reminderId } = req.body;

        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest("hex");

        if (expectedSignature === razorpay_signature) {

            // ✅ Mark reminder as paid + set paid_at date
            await Reminder.findByIdAndUpdate(
                reminderId,
                {
                    is_paid: true,
                    paid_at: new Date(),
                },
                { new: true }
            );

            return res.json({ success: true, message: "Payment verified successfully" });
        } else {
            return res.status(400).json({ success: false, message: "Invalid signature" });
        }

    } catch (error) {
        console.error("❌ Razorpay verification failed:", error);
        res.status(500).json({ success: false, message: "Verification error" });
    }
});

export default router;
