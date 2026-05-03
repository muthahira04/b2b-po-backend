const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getBudget,
  upsertDepartment,
  deleteDepartment,
  getCompany,
} = require('../controllers/companyController');

router.get('/', protect, getCompany);
router.get('/budget', protect, getBudget);
router.post('/department', protect, authorize('admin', 'superadmin'), upsertDepartment);
router.delete('/department/:name', protect, authorize('admin', 'superadmin'), deleteDepartment);

module.exports = router;