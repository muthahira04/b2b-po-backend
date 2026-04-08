const mongoose = require('mongoose');

const PurchaseOrderSchema = new mongoose.Schema({
  poNumber: {
    type: String,
    unique: true
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [{
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
    name: String,
    quantity: Number,
    unit: String,
    unitPrice: Number,
    totalPrice: Number
  }],
  totalAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: [
      'draft',
      'pending_approval',
      'approved',
      'rejected',
      'sent_to_vendor',
      'fulfilled',
      'partially_fulfilled',
      'cancelled'
    ],
    default: 'draft'
  },
  approvalChain: [{
    approverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    comment: String,
    actionAt: Date
  }],
  expectedDelivery: {
    type: Date
  },
  deliveryAddress: {
    type: String
  },
  notes: {
    type: String
  },
  fulfillment: {
    status: String,
    fulfilledAt: Date,
    receivedItems: [{
      itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
      receivedQty: Number
    }],
    vendorInvoiceNo: String
  },
  budgetExceeded: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// Auto generate PO number before saving
PurchaseOrderSchema.pre('save', async function(next) {
  if (!this.poNumber) {
    const count = await mongoose.model('PurchaseOrder').countDocuments();
    const year = new Date().getFullYear();
    this.poNumber = `PO-${year}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('PurchaseOrder', PurchaseOrderSchema);