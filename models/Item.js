const mongoose = require('mongoose');

const ItemSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String
  },
  unit: {
    type: String,
    enum: ['pcs', 'kg', 'litre', 'box', 'meter', 'set'],
    default: 'pcs'
  },
  category: {
    type: String,
    enum: ['Raw Material', 'Electronics', 'Logistics', 'Packaging', 'IT Services', 'Other'],
    default: 'Other'
  },
  standardPrice: {
    type: Number,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Item', ItemSchema);