const express = require('express');
const router = express.Router();
const {
  getPOs,
  getPO,
  createPO,
  submitPO,
  approvePO,
  rejectPO,
  fulfillPO,
  cancelPO,
  getStats
} = require('../controllers/poController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/stats', getStats);

router.route('/')
  .get(getPOs)
  .post(authorize('admin', 'manager'), createPO);

router.route('/:id')
  .get(getPO)
  .delete(authorize('admin', 'manager'), cancelPO);

router.post('/:id/submit', authorize('admin', 'manager'), submitPO);
router.post('/:id/approve', authorize('admin', 'approver'), approvePO);
router.post('/:id/reject', authorize('admin', 'approver'), rejectPO);
router.post('/:id/fulfill', authorize('admin', 'vendor'), fulfillPO);

module.exports = router;