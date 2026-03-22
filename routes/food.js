const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const mongoose = require('mongoose');
const Food = require('../models/Food');
const User = require('../models/User');
const auth = require('../middleware/auth');
const sendEmail = require('../utils/sendEmail');

// 🖼️ Multer setup for image upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext);
  }
});
const upload = multer({ storage });

// ===== AI HELPER FUNCTIONS =====

const autoCategorize = (title) => {
  const text = title.toLowerCase();
  if (/\b(bread|loaf|bun|roll|bagel|croissant|toast|dough)\b/.test(text)) return 'bread';
  if (/\b(rice|grain|quinoa|couscous|pasta|noodle|spaghetti|macaroni)\b/.test(text)) return 'rice';
  if (/\b(vegetable|carrot|potato|tomato|onion|broccoli|cabbage|lettuce|spinach|kale|cucumber)\b/.test(text)) return 'vegetables';
  if (/\b(fruit|apple|banana|orange|grape|berry|strawberry|mango|pineapple|watermelon)\b/.test(text)) return 'fruit';
  if (/\b(chicken|meat|beef|pork|fish|tofu|egg|beans|lentil|protein|turkey|salmon)\b/.test(text)) return 'protein';
  if (/\b(milk|cheese|yogurt|butter|cream|dairy|yoghurt|curd|paneer)\b/.test(text)) return 'dairy';
  if (/\b(snack|chip|cookie|cracker|chocolate|candy|biscuit|nuts)\b/.test(text)) return 'snacks';
  return 'other';
};

const predictExpiry = (category) => {
  const daysMap = {
    'bread': 2, 'dairy': 3, 'fruit': 3, 'vegetables': 4,
    'protein': 2, 'rice': 30, 'snacks': 60, 'other': 5
  };
  const days = daysMap[category] || 5;
  const predictedExpiry = new Date();
  predictedExpiry.setDate(predictedExpiry.getDate() + days);
  return predictedExpiry;
};

// ===== SINGLE DONATION =====
router.post('/', auth, upload.single('image'), async (req, res) => {
  try {
    const { title, description, quantity, location, address, landmark, expiryDate, lat, lng } = req.body;
    
    if (!title || !quantity || !location) {
      return res.status(400).json({ message: 'Title, quantity, and location are required' });
    }

    if (!expiryDate) {
      return res.status(400).json({ message: 'Expiry date is required' });
    }

    const imagePath = req.file ? req.file.path : null;
    const autoDetectedCategory = autoCategorize(title);
    
    const food = new Food({
      title,
      description,
      quantity,
      location,
      address: address || location,
      landmark: landmark || '',
      expiryDate: new Date(expiryDate),
      donor: req.user.id,
      image: imagePath,
      category: autoDetectedCategory,
      autoCategory: autoDetectedCategory,
      coordinates: lat && lng ? { lat: Number(lat), lng: Number(lng) } : undefined,
      locationDetected: !!(lat && lng),
      predictedExpiry: predictExpiry(autoDetectedCategory)
    });

    await food.save();
    res.status(201).json(food);
  } catch (err) {
    console.error('Create food error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ===== BULK DONATIONS =====
router.post('/bulk', auth, upload.array('images', 10), async (req, res) => {
  try {
    const donations = JSON.parse(req.body.donations);
    if (!Array.isArray(donations) || donations.length === 0) {
      return res.status(400).json({ message: 'At least one donation is required' });
    }

    const savedDonations = [];

    for (let i = 0; i < donations.length; i++) {
      const donation = donations[i];
      const imagePath = req.files && req.files[i] ? req.files[i].path : null;

      if (!donation.title || !donation.quantity || !donation.location) {
        throw new Error(`Donation ${i + 1} missing required fields`);
      }
      
      if (!donation.expiryDate) {
        throw new Error(`Donation ${i + 1} missing expiry date`);
      }

      const autoDetectedCategory = autoCategorize(donation.title || '');

      const food = new Food({
        title: donation.title,
        description: donation.description || '',
        quantity: donation.quantity,
        location: donation.location,
        address: donation.address || donation.location,
        landmark: donation.landmark || '',
        expiryDate: new Date(donation.expiryDate),
        donor: req.user.id,
        image: imagePath,
        category: donation.category || autoDetectedCategory,
        autoCategory: autoDetectedCategory,
        coordinates: donation.lat && donation.lng 
          ? { lat: Number(donation.lat), lng: Number(donation.lng) } 
          : (donation.latitude && donation.longitude 
            ? { lat: Number(donation.latitude), lng: Number(donation.longitude) }
            : undefined),
        locationDetected: !!(donation.lat && donation.lng) || !!(donation.latitude && donation.longitude),
        predictedExpiry: predictExpiry(autoDetectedCategory)
      });

      await food.save();
      savedDonations.push(food);
    }

    res.status(201).json(savedDonations);
  } catch (err) {
    console.error('Bulk upload error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ===== GET all available food =====
router.get('/', async (req, res) => {
  try {
    const { location } = req.query;
    const query = { claimed: false };
    if (location) {
      query.location = { $regex: location, $options: 'i' };
    }
    const foodList = await Food.find(query).populate('donor', 'name location').sort({ createdAt: -1 });
    res.json(foodList);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ===== GET donor's listings =====
router.get('/donor', auth, async (req, res) => {
  try {
    const listings = await Food.find({ donor: req.user.id }).sort({ createdAt: -1 });
    res.json(listings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ===== GET receiver's claimed food =====
router.get('/receiver', auth, async (req, res) => {
  try {
    const claims = await Food.find({ claimed: true, claimedBy: req.user.id })
      .populate('donor', 'name location')
      .sort({ claimedAt: -1 });
    res.json(claims);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ===== CLAIM food =====
router.patch('/:id/claim', auth, async (req, res) => {
  try {
    const food = await Food.findById(req.params.id);
    if (!food) return res.status(404).json({ message: 'Food not found' });
    if (food.claimed) return res.status(400).json({ message: 'Already claimed' });

    food.claimed = true;
    food.claimedBy = req.user.id;
    food.claimedAt = new Date();
    await food.save();

    const receiver = await User.findById(req.user.id);
    if (receiver) {
      const category = food.category || 'other';
      const statIndex = (receiver.claimStats || []).findIndex(s => s.category === category);
      if (statIndex >= 0) {
        receiver.claimStats[statIndex].count += 1;
        receiver.claimStats[statIndex].lastClaimedAt = new Date();
      } else {
        receiver.claimStats.push({ category, count: 1, lastClaimedAt: new Date() });
      }
      await receiver.save();
    }

    res.json(food);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ===== CONFIRM PICKUP =====
router.patch('/:id/pickup', auth, async (req, res) => {
  try {
    const food = await Food.findById(req.params.id);
    if (!food) return res.status(404).json({ message: 'Food not found' });
    if (food.claimedBy?.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    if (!food.claimed) return res.status(400).json({ message: 'Not claimed yet' });
    if (food.pickupConfirmed) return res.status(400).json({ message: 'Already confirmed' });

    food.pickupConfirmed = true;
    await food.save();
    res.json({ message: 'Pickup confirmed', food });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ===== EDIT donation =====
router.patch('/:id', auth, upload.single('image'), async (req, res) => {
  try {
    const food = await Food.findById(req.params.id);
    if (!food) return res.status(404).json({ message: 'Food not found' });
    if (food.donor.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (req.body.title) {
      food.title = req.body.title;
      food.category = autoCategorize(req.body.title);
      food.autoCategory = food.category;
    }
    if (req.body.description !== undefined) food.description = req.body.description;
    if (req.body.quantity) food.quantity = req.body.quantity;
    if (req.body.location) food.location = req.body.location;
    if (req.body.address !== undefined) food.address = req.body.address;
    if (req.body.landmark !== undefined) food.landmark = req.body.landmark;
    if (req.body.expiryDate) food.expiryDate = new Date(req.body.expiryDate);
    if (req.body.category) food.category = req.body.category;
    if (req.body.lat && req.body.lng) {
      food.coordinates = { lat: Number(req.body.lat), lng: Number(req.body.lng) };
      food.locationDetected = true;
    }
    if (req.file) food.image = req.file.path;

    await food.save();
    res.json(food);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ===== DELETE donation =====
router.delete('/:id', auth, async (req, res) => {
  try {
    const food = await Food.findById(req.params.id);
    if (!food) return res.status(404).json({ message: 'Food not found' });
    if (food.donor.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    await food.deleteOne();
    res.json({ message: 'Donation deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ===== OPTIMIZED ROUTE =====
router.get('/route/:receiverId', auth, async (req, res) => {
  try {
    if (req.user.id !== req.params.receiverId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const receiver = await User.findById(req.params.receiverId);
    if (!receiver) return res.status(404).json({ message: 'Receiver not found' });

    const claimedFood = await Food.find({ claimed: true, claimedBy: receiver._id, pickupConfirmed: false });
    const stops = claimedFood.filter(f => f.coordinates && typeof f.coordinates.lat === 'number' && typeof f.coordinates.lng === 'number')
      .map(f => ({ id: f._id, title: f.title, location: f.location, address: f.address, landmark: f.landmark, lat: f.coordinates.lat, lng: f.coordinates.lng, expiryDate: f.expiryDate }));

    res.json({ optimizedRoute: stops });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ===== AI EXPIRY PREDICTION =====
router.post('/ai/expiry-predict', auth, async (req, res) => {
  try {
    const { title, category } = req.body;
    const finalCategory = category || autoCategorize(title || '');
    const predictedExpiry = predictExpiry(finalCategory);
    res.json({ predictedExpiry, category: finalCategory });
  } catch (err) {
    res.status(500).json({ message: 'Error predicting expiry' });
  }
});

// ===== AI CLASSIFY =====
router.post('/ai/classify', auth, async (req, res) => {
  try {
    const { title } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ message: 'Title required' });
    const category = autoCategorize(title);
    res.json({ autoCategory: category, confidence: category === 'other' ? 30 : 85 });
  } catch (err) {
    res.status(500).json({ message: 'Error classifying food' });
  }
});

// ===== REMINDERS =====
router.get('/reminders', auth, async (req, res) => {
  try {
    const pastDonations = await Food.find({ donor: req.user._id }).sort({ createdAt: -1 }).limit(20);
    if (!pastDonations.length) return res.json({ reminders: [] });
    
    const reminders = [];
    const lastDonation = pastDonations[0];
    reminders.push({
      type: 'recent',
      title: lastDonation.title,
      message: `You donated "${lastDonation.title}" recently. Would you like to donate again?`,
      donationId: lastDonation._id
    });
    res.json({ reminders });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching reminders' });
  }
});

// ===== APPROVE REMINDER =====
router.post('/reminders/:id/approve', auth, async (req, res) => {
  try {
    const donation = await Food.findById(req.params.id);
    if (!donation) return res.status(404).json({ message: 'Donation not found' });

    const newDonation = new Food({
      title: donation.title,
      description: donation.description,
      quantity: donation.quantity,
      location: donation.location,
      address: donation.address,
      landmark: donation.landmark,
      donor: req.user._id,
      category: donation.category,
      autoCategory: donation.autoCategory,
      image: donation.image,
      coordinates: donation.coordinates,
      expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      predictedExpiry: predictExpiry(donation.category)
    });
    await newDonation.save();
    res.json({ message: 'Recurring donation created', newDonation });
  } catch (err) {
    res.status(500).json({ message: 'Error creating recurring donation' });
  }
});

module.exports = router;











