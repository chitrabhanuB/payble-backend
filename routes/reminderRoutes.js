const express = require('express');
const router = express.Router();
const Reminder = require('../models/reminder'); // must exist at backend/models/reminder.js

// ✅ Create a new reminder
router.post('/', async (req, res) => {
  try {
    console.log("📩 [DEBUG] Reminder POST route hit");
    console.log("📦 Request body:", req.body);

    const { user_id, bill_name, amount, due_date, priority, frequency } = req.body;
    if (!user_id || !bill_name || !due_date) {
      console.log("⚠️ Missing required fields");
      return res.status(400).json({ message: 'user_id, bill_name and due_date are required' });
    }

    const reminder = new Reminder({
      user_id,
      bill_name,
      amount: amount ?? null,
      due_date,
      priority: priority ?? 'medium',
      frequency: frequency ?? 'monthly',
      is_paid: false,
    });

    await reminder.save();
    console.log("✅ Reminder saved successfully:", reminder);
    return res.status(201).json({ success: true, reminder });
  } catch (err) {
    console.error('❌ POST /api/reminders error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});


// ✅ Get reminders due today for a specific user (⚠️ must be before '/:user_id')
router.get('/today/:user_id', async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const reminders = await Reminder.find({
      user_id: req.params.user_id,
      due_date: { $gte: startOfDay, $lte: endOfDay },
      is_paid: false,
    });

    res.json({ success: true, reminders });
  } catch (error) {
    console.error('Error fetching today’s reminders:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


// ✅ Fetch all reminders for a user
router.get('/:user_id', async (req, res) => {
  try {
    console.log(`📥 Fetching reminders for user: ${req.params.user_id}`);
    const reminders = await Reminder.find({ user_id: req.params.user_id });
    console.log(`✅ Found ${reminders.length} reminders`);
    res.json({ success: true, reminders });
  } catch (error) {
    console.error('❌ Error fetching reminders:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


// ✅ Delete a reminder by ID
router.delete('/:id', async (req, res) => {
  try {
    const reminder = await Reminder.findByIdAndDelete(req.params.id);
    if (!reminder) {
      return res.status(404).json({ success: false, message: 'Reminder not found' });
    }
    console.log(`🗑️ Reminder deleted successfully: ${req.params.id}`);
    res.json({ success: true, message: 'Reminder deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting reminder:', error.message);
    res.status(500).json({ success: false, message: 'Failed to delete reminder' });
  }
});


// ✅ Mark reminder as paid
router.put('/:id/mark-paid', async (req, res) => {
  try {
    const reminder = await Reminder.findByIdAndUpdate(
      req.params.id,
      { is_paid: true, paid_at: new Date() },
      { new: true }
    );

    if (!reminder) {
      return res.status(404).json({ success: false, message: 'Reminder not found' });
    }

    console.log(`✅ Reminder marked as paid: ${reminder._id}`);
    res.json({ success: true, reminder });
  } catch (error) {
    console.error('❌ Error marking reminder as paid:', error);
    res.status(500).json({ success: false, message: 'Failed to mark reminder as paid' });
  }
});

module.exports = router;
