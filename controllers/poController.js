const PurchaseOrder = require('../models/PurchaseOrder');
const Vendor = require('../models/Vendor');
const User = require('../models/User');

const getApprovalChain = async (amount, companyId) => {
  const approvers = [];

  if (amount < 50000) {
    let approver = await User.findOne({ companyId, role: 'approver' });
    // Fallback to admin if no approver found
    if (!approver) approver = await User.findOne({ companyId, role: 'admin' });
    if (approver) approvers.push({ approverId: approver._id, status: 'pending' });

  } else if (amount >= 50000 && amount < 500000) {
    let allApprovers = await User.find({ companyId, role: 'approver' }).limit(2);
    // Fallback to admin if not enough approvers
    if (allApprovers.length === 0) {
      const admin = await User.findOne({ companyId, role: 'admin' });
      if (admin) allApprovers = [admin];
    }
    allApprovers.forEach(a => approvers.push({ approverId: a._id, status: 'pending' }));

  } else {
    // High value — always goes to admin
    const admin = await User.findOne({ companyId, role: 'admin' });
    if (admin) approvers.push({ approverId: admin._id, status: 'pending' });
  }

  return approvers;
};

const getPOs = async (req, res) => {
  try {
    const query = { companyId: req.user.companyId };
    if (req.user.role === 'vendor') {
      const vendor = await Vendor.findOne({ userId: req.user._id });
      if (vendor) query.vendorId = vendor._id;
    }
    const pos = await PurchaseOrder.find(query)
      .populate('vendorId', 'businessName')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: pos.length, pos });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getPO = async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id)
      .populate('vendorId', 'businessName email phone')
      .populate('createdBy', 'name email')
      .populate('approvalChain.approverId', 'name role');
    if (!po) {
      return res.status(404).json({ success: false, message: 'PO not found' });
    }
    res.status(200).json({ success: true, po });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createPO = async (req, res) => {
  try {
    const { vendorId, items, expectedDelivery, deliveryAddress, notes, department } = req.body;
    const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const mappedItems = items.map(item => ({
      ...item,
      totalPrice: item.quantity * item.unitPrice
    }));

    // Budget check
    let budgetExceeded = false;
    const Company = require('../models/Company');
    const User = require('../models/User');
    
    const company = await Company.findById(req.user.companyId);
    if (company && department) {
      const dept = company.departments.find(d => d.name === department);
      if (dept) {
        const remainingBudget = dept.monthlyBudget - dept.spent;
        if (totalAmount > remainingBudget) {
          budgetExceeded = true;
        }
      }
    }

    // Build approval chain - get all approvers, managers, admins
    const approvalChain = [];
    const approvers = await User.find({ 
      companyId: req.user.companyId,
      role: { $in: ['approver', 'manager', 'admin'] }
    }).sort({ role: 1 });

    // Add each approver to the chain
    for (const approver of approvers) {
      approvalChain.push({
        approver: approver._id,
        status: 'pending',
        level: approvalChain.length + 1
      });
    }

    const po = await PurchaseOrder.create({
      companyId: req.user.companyId,
      vendorId,
      createdBy: req.user._id,
      items: mappedItems,
      totalAmount,
      expectedDelivery,
      deliveryAddress,
      notes,
      department,
      status: 'draft',
      budgetExceeded,
      approvalChain: approvalChain  // Use approvalChain field
    });

    res.status(201).json({
      success: true,
      po,
      budgetWarning: budgetExceeded ? 'This PO exceeds the department budget!' : null
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const submitPO = async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) {
      return res.status(404).json({ success: false, message: 'PO not found' });
    }
    if (po.status !== 'draft') {
      return res.status(400).json({ success: false, message: 'Only draft POs can be submitted' });
    }
    const approvalChain = await getApprovalChain(po.totalAmount, req.user.companyId);
    po.status = 'pending_approval';
    po.approvalChain = approvalChain;
    await po.save();
    res.status(200).json({ success: true, po });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Approve PO (for multi-level approval)
// @route   PUT /api/po/:id/approve
// @access  Private (approver/manager/admin)
const approvePO = async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id)
      .populate('vendorId', 'name')  // Change from 'vendor' to 'vendorId'
      .populate('items.item', 'name')
      .populate('approvalChain.approver', 'name email role');

    if (!po) {
      return res.status(404).json({ message: 'Purchase Order not found' });
    }

    // Find the current pending approval step for this user
    const currentStepIndex = po.approvalChain.findIndex(
      approval => approval.approver.toString() === req.user.id && 
                  approval.status === 'pending'
    );

    if (currentStepIndex === -1) {
      return res.status(403).json({ 
        message: 'You are not authorized to approve this PO at this stage' 
      });
    }

    // Update the current approval step
    po.approvalChain[currentStepIndex].status = 'approved';
    po.approvalChain[currentStepIndex].approvedAt = Date.now();

    // Check if this was the last approval
    const allApproved = po.approvalChain.every(approval => approval.status === 'approved');
    
    if (allApproved) {
      po.status = 'approved';
    } else {
      po.status = 'pending_approval';
    }

    await po.save();

    // Populate again for response
    const updatedPO = await PurchaseOrder.findById(po._id)
      .populate('vendorId', 'name')  // Change from 'vendor' to 'vendorId'
      .populate('items.item', 'name')
      .populate('approvalChain.approver', 'name email role');

    res.json(updatedPO);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

const rejectPO = async (req, res) => {
  try {
    const { comment } = req.body;
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) {
      return res.status(404).json({ success: false, message: 'PO not found' });
    }
    const approvalEntry = po.approvalChain.find(
      a => a.approverId.toString() === req.user._id.toString() && a.status === 'pending'
    );
    if (!approvalEntry) {
      return res.status(403).json({ success: false, message: 'Not authorized to reject this PO' });
    }
    approvalEntry.status = 'rejected';
    approvalEntry.comment = comment;
    approvalEntry.actionAt = new Date();
    po.status = 'rejected';
    await po.save();
    res.status(200).json({ success: true, po });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const fulfillPO = async (req, res) => {
  try {
    const { receivedItems, vendorInvoiceNo } = req.body;
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) {
      return res.status(404).json({ success: false, message: 'PO not found' });
    }
    const allFulfilled = receivedItems.every(ri => {
      const ordered = po.items.find(i => i._id.toString() === ri.itemId);
      return ordered && ri.receivedQty >= ordered.quantity;
    });
    po.fulfillment = {
      status: allFulfilled ? 'fulfilled' : 'partial',
      fulfilledAt: new Date(),
      receivedItems,
      vendorInvoiceNo
    };
    po.status = allFulfilled ? 'fulfilled' : 'partially_fulfilled';
    const vendor = await Vendor.findById(po.vendorId);
    if (vendor) {
      const onTime = new Date() <= new Date(po.expectedDelivery);
      vendor.totalOrders += 1;
      if (onTime) vendor.onTimeDeliveries += 1;
      vendor.riskScore = Math.round((vendor.onTimeDeliveries / vendor.totalOrders) * 100);
      await vendor.save();
    }
    await po.save();
    res.status(200).json({ success: true, po });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const cancelPO = async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) {
      return res.status(404).json({ success: false, message: 'PO not found' });
    }
    if (['fulfilled', 'cancelled'].includes(po.status)) {
      return res.status(400).json({ success: false, message: 'Cannot cancel this PO' });
    }
    po.status = 'cancelled';
    await po.save();
    res.status(200).json({ success: true, message: 'PO cancelled' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getStats = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const totalPOs = await PurchaseOrder.countDocuments({ companyId });
    const pendingPOs = await PurchaseOrder.countDocuments({ companyId, status: 'pending_approval' });
    const approvedPOs = await PurchaseOrder.countDocuments({ companyId, status: 'approved' });
    const fulfilledPOs = await PurchaseOrder.countDocuments({ companyId, status: 'fulfilled' });
    const spendResult = await PurchaseOrder.aggregate([
      { $match: { companyId, status: { $in: ['approved', 'sent_to_vendor', 'fulfilled', 'partially_fulfilled'] } } },
      { $group: { _id: null, totalSpend: { $sum: '$totalAmount' } } }
    ]);
    const totalSpend = spendResult[0]?.totalSpend || 0;
    const monthlySpend = await PurchaseOrder.aggregate([
      { $match: { companyId, status: { $in: ['approved', 'sent_to_vendor', 'fulfilled', 'partially_fulfilled'] } } },
      {
        $group: {
          _id: { month: { $month: '$createdAt' }, year: { $year: '$createdAt' } },
          spend: { $sum: '$totalAmount' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $limit: 6 }
    ]);
    res.status(200).json({
      success: true,
      stats: { totalPOs, pendingPOs, approvedPOs, fulfilledPOs, totalSpend },
      monthlySpend
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getPOs,
  getPO,
  createPO,
  submitPO,
  approvePO,
  rejectPO,
  fulfillPO,
  cancelPO,
  getStats
};