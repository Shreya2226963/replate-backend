const mongoose = require('mongoose');

const foodSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  quantity: { type: String, required: true },
  quantityUnit: { 
    type: String, 
    enum: ['kg', 'lbs', 'pieces', 'boxes', 'liters', 'servings', 'bags'],
    default: 'pieces'
  },
  location: { type: String, required: true },
  address: { type: String },
  landmark: { type: String },
  locationDetected: { type: Boolean, default: false },
  locationAccuracy: { type: Number },
  donor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  claimed: { type: Boolean, default: false },
  claimedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  claimedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  image: { type: String },
  pickupConfirmed: { type: Boolean, default: false },
  weightKg: { type: Number },
  category: {
    type: String,
    enum: ['bread', 'rice', 'vegetables', 'fruit', 'protein', 'dairy', 'snacks', 'other'],
    default: 'other'
  },
  donorHistoryTag: { type: String },
  coordinates: { lat: { type: Number }, lng: { type: Number } },
  predictedExpiry: { type: Date },
  autoCategory: { type: String },
  aiConfidence: { type: Number },
  recurringPattern: { frequency: String, item: String, quantity: String },
  lastReminderSent: { type: Date },
  autoApproved: { type: Boolean, default: false },
  expiryDate: { type: Date, required: true }
});

foodSchema.pre('save', function(next) {
  if (this.quantity && !this.quantityUnit) {
    const quantityStr = this.quantity.toLowerCase();
    if (quantityStr.includes('kg')) this.quantityUnit = 'kg';
    else if (quantityStr.includes('lb')) this.quantityUnit = 'lbs';
    else if (quantityStr.includes('box')) this.quantityUnit = 'boxes';
    else if (quantityStr.includes('liter')) this.quantityUnit = 'liters';
    else if (quantityStr.includes('bag')) this.quantityUnit = 'bags';
    else if (quantityStr.includes('serving')) this.quantityUnit = 'servings';
  }
  next();
});

module.exports = mongoose.model('Food', foodSchema);




