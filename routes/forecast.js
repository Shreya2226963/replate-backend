const express = require('express');
const router = express.Router();
const Food = require('../models/Food');
const auth = require('../middleware/auth');

/**
 * GET /api/forecast/category/:cat → Predict availability for a category
 */
router.get('/category/:cat', auth, async (req, res) => {
  try {
    const category = req.params.cat;
    const foods = await Food.find({ category });

    if (foods.length === 0) {
      return res.json({ message: `No data yet for ${category}` });
    }

    // Group by weekday
    const counts = Array(7).fill(0);
    foods.forEach(f => {
      const day = new Date(f.createdAt).getDay(); // 0=Sunday
      counts[day]++;
    });

    const maxDay = counts.indexOf(Math.max(...counts));
    const weekdays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

    res.json({
      category,
      prediction: `Most ${category} donations appear on ${weekdays[maxDay]}`,
      counts
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * GET /api/forecast/donor/:id → Predict donor’s posting pattern
 */
router.get('/donor/:id', auth, async (req, res) => {
  try {
    const foods = await Food.find({ donor: req.params.id });

    if (foods.length === 0) {
      return res.json({ message: 'No donations yet from this donor' });
    }

    const pattern = {};
    foods.forEach(f => {
      const cat = f.category || 'other';
      if (!pattern[cat]) pattern[cat] = { count: 0, last: null };
      pattern[cat].count++;
      pattern[cat].last = f.createdAt;
    });

    res.json({ donor: req.params.id, pattern });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
