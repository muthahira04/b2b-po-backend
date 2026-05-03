const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getPOs,
  getPO,
  createPO,
  submitPO,
  approvePO,
  rejectPO,
  fulfillPO,
  deletePO,
} = require('../controllers/poController');

router.route('/').get(protect, getPOs).post(protect, authorize('admin', 'manager', 'superadmin'), createPO);

router.route('/:id').get(protect, getPO).delete(protect, authorize('admin', 'superadmin'), deletePO);

router.put('/:id/submit', protect, authorize('admin', 'manager', 'superadmin'), submitPO);
router.put('/:id/approve', protect, authorize('admin', 'manager', 'approver', 'superadmin'), approvePO);
router.put('/:id/reject', protect, authorize('admin', 'manager', 'approver', 'superadmin'), rejectPO);
router.put('/:id/fulfill', protect, authorize('vendor', 'admin', 'superadmin'), fulfillPO);

module.exports = router;