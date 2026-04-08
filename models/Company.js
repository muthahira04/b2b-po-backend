const mongoose = require('mongoose');

const CompanySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true
  },
  phone: {
    type: String
  },
  address: {
    type: String
  },
  gstin: {
    type: String
  },
  logo: {
    type: String
  },
  departments: [{
    name: String,
    monthlyBudget: Number,
    spent: { type: Number, default: 0 }
  }]
}, { timestamps: true });

module.exports = mongoose.model('Company', CompanySchema);