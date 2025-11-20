require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const crypto = require('crypto');
const Razorpay = require('razorpay');

const reminderRoutes = require('./routes/reminderRoutes');
const userRoutes = require('./routes/userRoutes');
const verifyUser = require('./middleware/verifyUser');
const Reminder = require("./models/reminder");
const { createClient } = require('@supabase/supabase-js');

const app = express();

// ✅ Initialize Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// ✅ Initialize Razorpay
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.error("❌ Missing Razorpay credentials in .env");
}
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Route handler moved to reminderRoutes.js

// ✅ Webhook route (must come before express.json())
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;
    const signature = req.headers['x-razorpay-signature'];
    const expected = crypto.createHmac('sha256', secret).update(req.body).digest('hex');

    if (signature !== expected) {
      console.warn('⚠️ Invalid Razorpay webhook signature');
      return res.status(400).send('invalid signature');
    }

    const payload = JSON.parse(req.body.toString());
    console.log('✅ Razorpay webhook event:', payload.event);

    if (payload.event === 'payment.captured') {
      const payment = payload.payload.payment.entity;
      console.log('💰 Payment captured:', payment.id, 'order_id:', payment.order_id);
    }

    return res.json({ status: 'ok' });
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).send('server error');
  }
});

// ✅ Middlewares
app.use(cors({
  origin: "http://localhost:8080", // Match Vite dev server port from vite.config.ts
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// ✅ User Routes
app.use("/api/users", userRoutes);

// ✅ Reminder Routes
app.use('/api/reminders', reminderRoutes);

// ✅ Razorpay: Create Order
app.post('/api/payments/create-order', async (req, res) => {
  try {
    const { amount, currency = 'INR', receipt } = req.body;

    if (!amount || isNaN(amount)) {
      return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    const options = {
      amount: Math.round(Number(amount) * 100), // paise
      currency,
      receipt: receipt || `rcpt_${Date.now()}`,
      payment_capture: 1,
    };

    const order = await razorpay.orders.create(options);
    return res.json({ success: true, order, key: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    console.error('❌ Razorpay create-order error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create order', error: err.message });
  }
});

// ✅ Razorpay: Verify Signature
app.post('/api/payments/verify', async (req, res) => {
  try {
    console.log("🔥 VERIFY API HIT");
    console.log("📩 BODY RECEIVED:", req.body);

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, reminderId } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !reminderId) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const generated_signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generated_signature !== razorpay_signature) {
      console.warn('⚠️ Invalid payment signature');
      return res.status(400).json({ success: false, validated: false, message: 'Invalid signature' });
    }

    console.log("🟢 SIGNATURE MATCHED!");

    // 🔥 UPDATE REMINDER IN DATABASE
    const updated = await Reminder.findByIdAndUpdate(
      reminderId,
      { is_paid: true, paid_at: new Date() },
      { new: true }
    );

    console.log("🔥 UPDATED REMINDER:", updated);

    return res.json({ success: true, validated: true, updated });

  } catch (err) {
    console.error('Payment verify error:', err);
    return res.status(500).json({ success: false, message: 'Verification failed', error: err.message });
  }
});

app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});


// ✅ MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

mongoose.connection.once('open', () => {
  console.log("📂 Connected to database:", mongoose.connection.name);
});

// ✅ Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
