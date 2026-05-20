const Company = require('../models/Company');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide name, email and password' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const user = await User.create({ name, email, password, role: role || 'manager' });
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, companyId: user.companyId }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Your account has been deactivated. Contact your admin.' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, companyId: user.companyId }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUBLIC — no auth required
// Creates company + first admin account in one shot
const setupCompany = async (req, res) => {
  let company = null;
  try {
    const {
      // Company fields
      companyName, companyEmail, companyPhone, companyAddress, taxId,
      // Admin account fields
      adminName, adminEmail, adminPassword
    } = req.body;

    // Validate all required fields
    if (!companyName || !companyEmail || !adminName || !adminEmail || !adminPassword) {
      return res.status(400).json({
        success: false,
        message: 'Company name, company email, admin name, admin email and password are all required'
      });
    }

    // Check admin email not already taken
    const existingUser = await User.findOne({ email: adminEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this admin email already exists'
      });
    }

    // Check company email not already registered
    const existingCompany = await Company.findOne({ email: companyEmail });
    if (existingCompany) {
      return res.status(400).json({
        success: false,
        message: 'A company with this email is already registered'
      });
    }

    // Create company first
    company = await Company.create({
      name: companyName,
      email: companyEmail,
      phone: companyPhone || '',
      address: companyAddress || '',
      taxId: taxId || '',
      departments: []
    });

    // Create admin user linked to this company
    const admin = await User.create({
      name: adminName,
      email: adminEmail,
      password: adminPassword,
      role: 'admin',
      companyId: company._id,
      isActive: true
    });

    // Update company with createdBy
    company.createdBy = admin._id;
    await company.save();

    const token = generateToken(admin._id);

    res.status(201).json({
      success: true,
      message: 'Company registered successfully. You can now log in.',
      token,
      user: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        companyId: company._id
      },
      company: {
        id: company._id,
        name: company.name,
        email: company.email
      }
    });

  } catch (error) {
    // Cleanup: if company was created but user creation failed, remove the company
    // so the admin can try again without a duplicate company email error
    if (company) {
      await Company.findByIdAndDelete(company._id).catch(() => {});
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { register, login, getMe, setupCompany };