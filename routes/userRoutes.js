const express = require("express");
const router = express.Router();
const verifyUser = require("../middleware/verifyUser");
const mongoose = require("mongoose");

// Simple schema for demo
const UserSchema = new mongoose.Schema({
  user_id: String,
  full_name: String,
  email: String,
  monthly_income: Number,
  misc_monthly_expenses: Number,
});

const User = mongoose.model("User", UserSchema);

// Save new user
router.post("/", verifyUser, async (req, res) => {
  try {
    const { user_id, full_name, email, monthly_income, misc_monthly_expenses } = req.body;
    if (!user_id || !email) return res.status(400).json({ message: "Missing user_id or email" });

    const existing = await User.findOne({ user_id });
    if (existing) return res.status(200).json({ success: true, message: "User already exists" });

    const newUser = new User({ user_id, full_name, email, monthly_income, misc_monthly_expenses });
    await newUser.save();

    res.status(201).json({ success: true, user: newUser });
  } catch (err) {
    console.error("User creation error:", err);
    res.status(500).json({ success: false, message: "Failed to create user" });
  }
});

module.exports = router;
