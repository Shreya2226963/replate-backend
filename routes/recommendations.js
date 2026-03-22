// routes/recommendations.js
const express = require('express');
const router = express.Router();
const Food = require('../models/Food');
const User = require('../models/User');
const auth = require('../middleware/auth');

// GET /api/recommendations/receivers/:id → Personalized suggestions
router.get('/receivers/:id', auth, async (req, res) => {
  try {
    // Only allow self or admin
    if (req.user.id !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const receiver = await User.findById(req.params.id);
    if (!receiver) return res.status(404).json({ message: 'Receiver not found' });

    // Sort preferences by claim count
    const prefs = [...(receiver.claimStats || [])].sort((a, b) => b.count - a.count);
    const preferredCats = prefs.map(p => p.category);
    const primaryLocation = receiver.location;

    // Fetch available food
    const available = await Food.find({ claimed: false });

    // Score items
    const scored = available.map(item => {
      let score = 0;

      // Category preference boost
      const catIndex = preferredCats.indexOf(item.category || 'other');
      if (catIndex >= 0) {
        score += (preferredCats.length - catIndex) * 10;
      }

      // Location match boost
      if (primaryLocation && item.location &&
          item.location.toLowerCase() === primaryLocation.toLowerCase()) {
        score += 15;
      }

      // Recency boost (closer expiry date = higher score)
      if (item.expiryDate) {
        const daysLeft = Math.ceil((new Date(item.expiryDate) - Date.now()) / (1000*60*60*24));
        score += Math.max(0, 10 - daysLeft);
      }

      return { item, score };
    });

    const sorted = scored.sort((a, b) => b.score - a.score).map(s => s.item).slice(0, 20);

    res.json({ recommendations: sorted, preferences: prefs });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
