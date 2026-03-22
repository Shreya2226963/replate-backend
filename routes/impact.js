const express = require('express');
const Food = require('../models/Food');
const auth = require('../middleware/auth');
const router = express.Router();

// GET /api/impact → Returns impact stats for logged-in user
router.get('/', auth, async (req, res) => {
  try {
    const donated = await Food.find({ donor: req.user.id });
    const claimed = await Food.find({ claimedBy: req.user.id });

    const totalMeals = claimed.length;
    const totalFoodSaved = donated.reduce((sum, item) => sum + (item.weightKg || 0), 0);
    const totalCO2Saved = totalFoodSaved * 2.5; // Example: 2.5kg CO₂ saved per kg

    res.json({
      totalMeals,
      totalFoodSaved,
      totalCO2Saved
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
