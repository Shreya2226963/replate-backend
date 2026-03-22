const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const Food = require('../models/Food');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

const router = express.Router();

// ✅ GET all users (admin only)
router.get('/users', auth, admin, async (req, res) => {
  const users = await User.find().select('-password');
  res.json(users);
});

// ✅ GET all food listings (admin only)
router.get('/listings', auth, admin, async (req, res) => {
  const listings = await Food.find().populate('donor claimedBy', 'name email');
  res.json(listings);
});

// ✅ POST: Create admin account (one-time, protected by secret key)
router.post('/create-admin', async (req, res) => {
  const secret = req.headers['x-secret-key'];

  if (secret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ message: 'Forbidden: Invalid secret key' });
  }

  const existingAdmin = await User.findOne({ role: 'admin' });
  if (existingAdmin) {
    return res.status(400).json({ message: 'Admin already exists' });
  }

  const hashedPassword = await bcrypt.hash('yourStrongPassword', 10);

  const adminUser = new User({
    name: 'Shreya',
    email: 'admin@replate.com',
    password: hashedPassword,
    role: 'admin',
  });

  await adminUser.save();
  res.status(201).json({ message: 'Admin account created successfully' });
});

module.exports = router;

