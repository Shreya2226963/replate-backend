const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();

// ===== CORS - Simple and working =====
app.use(cors({
  origin: true,
  credentials: true
}));

// ===== Middleware =====
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ===== Create uploads folder if it doesn't exist =====
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
  console.log('📁 Uploads folder created');
}

// ===== Import routes =====
const authRoutes = require('./routes/auth');
const foodRoutes = require('./routes/food');
const impactRoutes = require('./routes/impact');
const adminRoutes = require('./routes/admin');
const recommendationsRoutes = require('./routes/recommendations');
const forecastRoutes = require('./routes/forecast');
const aiRoutes = require('./routes/ai');

// ===== Route handlers =====
app.use('/api/auth', authRoutes);
app.use('/api/food', foodRoutes);
app.use('/api/impact', impactRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/recommendations', recommendationsRoutes);
app.use('/api/forecast', forecastRoutes);
app.use('/api/ai', aiRoutes);

// ===== Test route =====
app.get('/', (req, res) => {
  res.json({ message: 'Replate backend is running!' });
});

// ===== 404 handler =====
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// ===== Error handler =====
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Server error' });
});

// ===== Start server =====
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB error:', err);
  });


