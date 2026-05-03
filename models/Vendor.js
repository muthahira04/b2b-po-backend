const mongoose = require('mongoose');

const VendorSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  businessName: {
    type: String,
    required: true,
    trim: true
  },
  contactPerson: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true
  },
  phone: {
    type: String,
    required: true
  },
  address: {
    type: String
  },
  gstin: {
    type: String
  },
  category: {
    type: String,
    enum: ['Raw Material', 'Electronics', 'Logistics', 'Packaging', 'IT Services', 'Other'],
    default: 'Other'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'blacklisted'],
    default: 'active'
  },
  riskScore: {
    type: Number,
    default: 100
  },
  totalOrders: {
    type: Number,
    default: 0
  },
  onTimeDeliveries: {
    type: Number,
    default: 0
  },
  bankDetails: {
    accountNo: String,
    ifsc: String,
    bankName: String
  }
}, { timestamps: true });

module.exports = mongoose.model('Vendor', VendorSchema);