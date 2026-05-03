const mongoose = require('mongoose');

const DepartmentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  monthlyBudget: { type: Number, required: true, default: 0 },
  spent: { type: Number, default: 0 },
});

const CompanySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String },
    phone: { type: String },
    email: { type: String },
    taxId: { type: String },
    departments: [DepartmentSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Company', CompanySchema);