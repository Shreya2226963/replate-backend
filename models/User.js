const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // 👤 Basic info
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['donor', 'receiver', 'admin'], required: true },
  location: { type: String },

  // 📊 Claim history stats for receivers (for recommendations)
  claimStats: [
    {
      category: { type: String },          // e.g., 'bread', 'vegetables'
      count: { type: Number, default: 0 }, // how many times claimed
      lastClaimedAt: { type: Date }        // when last claimed
    }
  ],

  // 🗺️ Coordinates for route optimization (lat/lng)
  coordinates: {
    lat: { type: Number },
    lng: { type: Number }
  },

  // 📅 Donor posting patterns (for availability forecasts)
  donationPatterns: [
    {
      category: { type: String },          // e.g., 'vegetables'
      frequency: { type: Number, default: 0 }, // how many times donated
      lastDonatedAt: { type: Date }        // last donation timestamp
    }
  ]
});

module.exports = mongoose.model('User', userSchema);



