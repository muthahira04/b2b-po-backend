const express = require('express');
const router = express.Router();
const {
  getItems,
  getItem,
  createItem,
  updateItem,
  deleteItem
} = require('../controllers/itemController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getItems)
  .post(authorize('admin', 'manager'), createItem);

router.route('/:id')
  .get(getItem)
  .put(authorize('admin', 'manager'), updateItem)
  .delete(authorize('admin'), deleteItem);

module.exports = router;