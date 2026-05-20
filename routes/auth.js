const express = require('express');
const router = express.Router();
const { register, login, getMe, setupCompany } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.post('/setup-company', setupCompany); // ← no protect, public endpoint

module.exports = router;