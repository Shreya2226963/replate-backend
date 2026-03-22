const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

/**
 * Auto-categorize food based on title
 */
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

/**
 * Predict expiry based on category
 */
const predictExpiry = (category) => {
  const daysMap = {
    'bread': 2,
    'dairy': 3,
    'fruit': 3,
    'vegetables': 4,
    'protein': 2,
    'rice': 30,
    'snacks': 60,
    'other': 5
  };
  
  const days = daysMap[category] || 5;
  const predictedExpiry = new Date();
  predictedExpiry.setDate(predictedExpiry.getDate() + days);
  return predictedExpiry;
};

// POST /api/ai/expiry-predict
router.post('/expiry-predict', auth, async (req, res) => {
  try {
    const { title, category } = req.body;
    
    // Use provided category or auto-detect
    const finalCategory = category || autoCategorize(title || '');
    const predictedExpiry = predictExpiry(finalCategory);
    
    // Add some intelligent reasoning
    let reasoning = '';
    if (category) {
      reasoning = `Based on the category "${category}", this food typically lasts ${predictExpiry(category) - new Date()} days.`;
    } else {
      reasoning = `Based on the title "${title}", I categorized this as "${finalCategory}" which typically lasts until ${predictedExpiry.toDateString()}.`;
    }
    
    res.json({ 
      predictedExpiry,
      category: finalCategory,
      reasoning,
      confidence: finalCategory === 'other' ? 40 : 85
    });
  } catch (err) {
    console.error('Expiry prediction error:', err);
    res.status(500).json({ message: 'Error predicting expiry' });
  }
});

// POST /api/ai/classify
router.post('/classify', auth, async (req, res) => {
  try {
    const { title, description } = req.body;
    
    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Title is required' });
    }
    
    // Combine title and description for better classification
    const text = `${title} ${description || ''}`.toLowerCase();
    const category = autoCategorize(text);
    
    // Calculate confidence based on keyword matches
    let confidence = 30; // base confidence
    let matchedKeywords = [];
    
    const keywordChecks = {
      'bread': ['bread', 'loaf', 'bun', 'roll', 'bagel', 'toast'],
      'rice': ['rice', 'grain', 'pasta', 'noodle'],
      'vegetables': ['carrot', 'potato', 'tomato', 'onion', 'broccoli', 'cabbage'],
      'fruit': ['apple', 'banana', 'orange', 'grape', 'berry', 'mango'],
      'protein': ['chicken', 'meat', 'fish', 'egg', 'tofu', 'beans'],
      'dairy': ['milk', 'cheese', 'yogurt', 'butter', 'cream'],
      'snacks': ['snack', 'chip', 'cookie', 'cracker', 'chocolate']
    };
    
    if (keywordChecks[category]) {
      const matches = keywordChecks[category].filter(keyword => text.includes(keyword));
      matchedKeywords = matches;
      confidence = Math.min(30 + matches.length * 15, 95);
    }
    
    res.json({ 
      autoCategory: category,
      confidence,
      matchedKeywords,
      detectedFrom: matchedKeywords.length > 0 ? 'keywords' : 'general'
    });
  } catch (err) {
    console.error('Classification error:', err);
    res.status(500).json({ message: 'Error classifying food' });
  }
});

// GET /api/ai/health - Check if AI service is running
router.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    message: 'AI service is running',
    categories: ['bread', 'rice', 'vegetables', 'fruit', 'protein', 'dairy', 'snacks', 'other']
  });
});

module.exports = router;
