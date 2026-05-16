const PurchaseOrder = require('../models/PurchaseOrder');
const Vendor = require('../models/Vendor');
const Item = require('../models/Item');
const User = require('../models/User');
const Company = require('../models/Company');

// FLAW 2 FIX: companyId scoped
const buildApprovalChain = async (totalAmount, companyId) => {
  const chain = [];

  const admin = await User.findOne({ role: 'admin', companyId }).select('_id name email');
  if (admin) chain.push({ approverId: admin._id, name: admin.name, role: 'admin', status: 'pending' });

  if (totalAmount > 1000) {
    const manager = await User.findOne({ role: 'manager', companyId }).select('_id name email');
    if (manager) chain.push({ approverId: manager._id, name: manager.name, role: 'manager', status: 'pending' });
  }

  if (totalAmount > 5000) {
    const approvers = await User.find({ role: 'approver', companyId }).select('_id name email').limit(2);
    approvers.forEach((a) =>
      chain.push({ approverId: a._id, name: a.name, role: 'approver', status: 'pending' })
    );
  }

  return chain;
};

const getPOs = async (req, res) => {
  try {
    let filter = {};

    if (req.user.role === 'vendor') {
      const vendor = await Vendor.findOne({ userId: req.user.id });
      if (!vendor) return res.json({ success: true, data: [] });
      filter.vendorId = vendor._id;
    }

    const pos = await PurchaseOrder.find(filter)
      .populate('vendorId', 'businessName riskScore')
      .populate('createdBy', 'name')
      .sort('-createdAt');

    res.json({ success: true, count: pos.length, data: pos });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getPO = async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id)
      .populate('vendorId', 'businessName email phone riskScore')
      .populate('createdBy', 'name email')
      .populate('approvalChain.approverId', 'name email');

    if (!po) return res.status(404).json({ success: false, message: 'PO not found' });

    if (req.user.role === 'vendor') {
      const vendor = await Vendor.findOne({ userId: req.user.id });
      if (!vendor || po.vendorId._id.toString() !== vendor._id.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    res.json({ success: true, data: po });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const createPO = async (req, res) => {
  try {
    const { vendorId, items, notes, expectedDelivery, deliveryAddress, department } = req.body;

    if (!vendorId) return res.status(400).json({ success: false, message: 'Vendor is required' });
    if (!items || items.length === 0) return res.status(400).json({ success: false, message: 'At least one item is required' });

    // Items are saved with quantity and name only — no price yet (vendor will quote)
    const resolvedItems = [];
    for (const entry of items) {
      const item = await Item.findById(entry.itemId);
      if (!item) return res.status(400).json({ success: false, message: `Item not found` });
      resolvedItems.push({
        itemId: entry.itemId,
        name: item.name,
        quantity: entry.quantity,
        unit: item.unit,
        unitPrice: 0,
        totalPrice: 0,
        vendorCanSupply: true,
        vendorNote: ''
      });
    }

    const po = await PurchaseOrder.create({
      companyId: req.user.companyId,
      vendorId,
      items: resolvedItems,
      totalAmount: 0,
      notes,
      expectedDelivery,
      deliveryAddress,
      department,
      budgetExceeded: false,
      status: 'draft',
      createdBy: req.user.id,
    });

    res.status(201).json({ success: true, data: po });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Buyer sends PO to vendor for quoting
const sendForQuote = async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) return res.status(404).json({ success: false, message: 'PO not found' });
    if (po.status !== 'draft') {
      return res.status(400).json({ success: false, message: 'Only draft POs can be sent for quote' });
    }

    po.status = 'pending_quote';
    await po.save();

    res.json({ success: true, data: po });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Vendor submits their quote — price per line item + can/cannot supply
const submitQuote = async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) return res.status(404).json({ success: false, message: 'PO not found' });
    if (po.status !== 'pending_quote') {
      return res.status(400).json({ success: false, message: 'PO is not awaiting a quote' });
    }

    // Verify this vendor owns this PO
    const vendor = await Vendor.findOne({ userId: req.user.id });
    if (!vendor || po.vendorId.toString() !== vendor._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { items } = req.body;
    // items: [{ itemId, unitPrice, vendorCanSupply, vendorNote }]
    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Quote items are required' });
    }

    let totalAmount = 0;
    po.items = po.items.map((existing) => {
      const quoted = items.find((q) => q.itemId === existing.itemId.toString());
      if (!quoted) return existing;

      const canSupply = quoted.vendorCanSupply !== false;
      const unitPrice = canSupply ? Number(quoted.unitPrice) || 0 : 0;
      const totalPrice = canSupply ? unitPrice * existing.quantity : 0;
      totalAmount += totalPrice;

      return {
        ...existing.toObject(),
        unitPrice,
        totalPrice,
        vendorCanSupply: canSupply,
        vendorNote: quoted.vendorNote || ''
      };
    });

    po.totalAmount = totalAmount;
    po.status = 'quoted';
    await po.save();

    res.json({ success: true, data: po });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Buyer reviews quoted PO and submits for internal approval
const submitPO = async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) return res.status(404).json({ success: false, message: 'PO not found' });

    if (po.status !== 'quoted') {
      return res.status(400).json({ success: false, message: 'PO must be quoted by vendor before submitting for approval' });
    }

    // Check if any items cannot be supplied
    const unsupplied = po.items.filter((i) => !i.vendorCanSupply);
    if (unsupplied.length === po.items.length) {
      return res.status(400).json({ success: false, message: 'Vendor cannot supply any items on this PO. Please create a new PO with a different vendor.' });
    }

    // Budget check using companyId — FLAW 4 FIX
    let budgetWarning = null;
    let budgetExceeded = false;
    if (po.department) {
      const company = await Company.findById(po.companyId);
      if (company) {
        const dept = company.departments.find(
          (d) => d.name.toLowerCase() === po.department.toLowerCase()
        );
        if (dept) {
          const remaining = dept.monthlyBudget - dept.spent;
          if (po.totalAmount > remaining) {
            budgetExceeded = true;
            budgetWarning = {
              department: dept.name,
              monthlyBudget: dept.monthlyBudget,
              spent: dept.spent,
              remaining,
              requested: po.totalAmount,
              overage: po.totalAmount - remaining,
            };
          }
        }
      }
    }

    po.budgetExceeded = budgetExceeded;
    po.approvalChain = await buildApprovalChain(po.totalAmount, po.companyId);
    po.status = 'pending_approval';
    await po.save();

    res.json({ success: true, data: po, budgetWarning });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const approvePO = async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) return res.status(404).json({ success: false, message: 'PO not found' });
    if (po.status !== 'pending_approval') {
      return res.status(400).json({ success: false, message: 'PO is not pending approval' });
    }

    const myEntry = po.approvalChain.find(
      (a) => a.approverId.toString() === req.user.id && a.status === 'pending'
    );
    if (!myEntry) {
      return res.status(403).json({ success: false, message: 'You are not an approver for this PO or have already acted' });
    }

    myEntry.status = 'approved';
    myEntry.actionAt = new Date();

    const allApproved = po.approvalChain.every((a) => a.status === 'approved');
    if (allApproved) {
      po.status = 'approved';

      // FLAW 3 FIX: use Company.findById(po.companyId)
      if (po.department) {
        const company = await Company.findById(po.companyId);
        if (company) {
          const dept = company.departments.find(
            (d) => d.name.toLowerCase() === po.department.toLowerCase()
          );
          if (dept) {
            dept.spent += po.totalAmount;
            await company.save();
          }
        }
      }
    }

    await po.save();
    res.json({ success: true, data: po });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const rejectPO = async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) return res.status(404).json({ success: false, message: 'PO not found' });

    const myEntry = po.approvalChain.find(
      (a) => a.approverId.toString() === req.user.id && a.status === 'pending'
    );
    if (!myEntry) {
      return res.status(403).json({ success: false, message: 'You are not an approver for this PO or have already acted' });
    }

    myEntry.status = 'rejected';
    myEntry.actionAt = new Date();
    po.status = 'rejected';
    await po.save();

    res.json({ success: true, data: po });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const fulfillPO = async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) return res.status(404).json({ success: false, message: 'PO not found' });
    if (po.status !== 'approved') {
      return res.status(400).json({ success: false, message: 'Only approved POs can be fulfilled' });
    }

    if (req.user.role === 'vendor') {
      const vendor = await Vendor.findOne({ userId: req.user.id });
      if (!vendor || po.vendorId.toString() !== vendor._id.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    po.status = 'fulfilled';
    po.fulfillment.status = 'fulfilled';
    po.fulfillment.fulfilledAt = new Date();
    await po.save();

    const vendor = await Vendor.findById(po.vendorId);
    if (vendor) {
      const deliveredOnTime = po.expectedDelivery && new Date() <= new Date(po.expectedDelivery);
      vendor.totalOrders = (vendor.totalOrders || 0) + 1;
      if (deliveredOnTime) vendor.onTimeDeliveries = (vendor.onTimeDeliveries || 0) + 1;
      vendor.riskScore =
        vendor.totalOrders > 0
          ? Math.round((vendor.onTimeDeliveries / vendor.totalOrders) * 100)
          : 100;
      await vendor.save();
    }

    res.json({ success: true, data: po });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const deletePO = async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) return res.status(404).json({ success: false, message: 'PO not found' });
    if (po.status !== 'draft') {
      return res.status(400).json({ success: false, message: 'Only draft POs can be deleted' });
    }
    await po.deleteOne();
    res.json({ success: true, data: {} });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getPOs, getPO, createPO, sendForQuote, submitQuote, submitPO, approvePO, rejectPO, fulfillPO, deletePO };