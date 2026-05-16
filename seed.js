require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('./models/User');
const Vendor = require('./models/Vendor');
const Company = require('./models/Company');
const Item = require('./models/Item');

const MONGO_URI = process.env.MONGO_URI;

const departments = [
  { name: 'Engineering', monthlyBudget: 50000, spent: 12400 },
  { name: 'Operations',  monthlyBudget: 30000, spent: 28100 },
  { name: 'Marketing',   monthlyBudget: 20000, spent: 7600  },
  { name: 'HR',          monthlyBudget: 15000, spent: 3200  },
  { name: 'Procurement', monthlyBudget: 40000, spent: 21000 },
];

const sampleItems = [
  { name: 'Steel Rods',        unit: 'kg',    category: 'Raw Material',  standardPrice: 200  },
  { name: 'Copper Wire',       unit: 'meter', category: 'Raw Material',  standardPrice: 85   },
  { name: 'Cardboard Boxes',   unit: 'pcs',   category: 'Packaging',     standardPrice: 12   },
  { name: 'Laptop',            unit: 'pcs',   category: 'Electronics',   standardPrice: 55000 },
  { name: 'Office Chair',      unit: 'pcs',   category: 'Other',         standardPrice: 8000 },
  { name: 'Diesel (bulk)',     unit: 'litre', category: 'Logistics',     standardPrice: 95   },
  { name: 'Server Rack Unit',  unit: 'pcs',   category: 'IT Services',   standardPrice: 18000 },
  { name: 'Bubble Wrap Roll',  unit: 'box',   category: 'Packaging',     standardPrice: 450  },
];

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  // 1. Find or create company
  let company = await Company.findOne({ name: 'ProcureDesk Corp' });
  if (!company) {
    company = await Company.create({
      name: 'ProcureDesk Corp',
      email: 'info@procuredesk.com',
      phone: '9876543210',
      address: 'Bengaluru, Karnataka',
      departments,
    });
    console.log('  created company: ProcureDesk Corp');
  } else {
    // Ensure departments exist
    for (const dept of departments) {
      const exists = company.departments.find(
        (d) => d.name.toLowerCase() === dept.name.toLowerCase()
      );
      if (!exists) {
        company.departments.push(dept);
        console.log(`  added dept: ${dept.name}`);
      }
    }
    await company.save();
    console.log(`  using existing company: ${company.name} (${company._id})`);
  }

  // 2. Users — all linked to this company
  const usersToSeed = [
    { name: 'Admin User',      email: 'admin@procuredesk.com',     password: '123456', role: 'admin'    },
    { name: 'Sarah Manager',   email: 'manager@procuredesk.com',   password: '123456', role: 'manager'  },
    { name: 'Alex Approver',   email: 'approver1@procuredesk.com', password: '123456', role: 'approver' },
    { name: 'Beth Approver',   email: 'approver2@procuredesk.com', password: '123456', role: 'approver' },
    { name: 'ABC Vendor User', email: 'vendor@abcsuppliers.com',   password: '123456', role: 'vendor'   },
  ];

  const createdUsers = {};
  for (const u of usersToSeed) {
    let user = await User.findOne({ email: u.email });
    if (user) {
      // Fix: ensure companyId is set even on existing users
      if (!user.companyId) {
        user.companyId = u.role === 'vendor' ? undefined : company._id;
        await user.save();
        console.log(`  fixed companyId for: ${u.email}`);
      } else {
        console.log(`  skip (exists): ${u.email}`);
      }
    } else {
      const salt = await bcrypt.genSalt(10);
      const hashed = await bcrypt.hash(u.password, salt);
      user = await User.create({
        ...u,
        password: hashed,
        companyId: u.role === 'vendor' ? undefined : company._id,
      });
      console.log(`  created: ${u.email} (${u.role})`);
    }
    createdUsers[u.email] = user;
  }

  // 3. Link vendor user to ABC Suppliers vendor profile
  const vendorUser = createdUsers['vendor@abcsuppliers.com'];
  if (vendorUser) {
    const abcVendor = await Vendor.findOne({ businessName: /ABC/i });
    if (abcVendor && !abcVendor.userId) {
      abcVendor.userId = vendorUser._id;
      await abcVendor.save();
      console.log('  linked vendor user → ABC Suppliers');
    } else if (!abcVendor) {
      // Create ABC Suppliers vendor if it doesn't exist
      await Vendor.create({
        companyId: company._id,
        businessName: 'ABC Suppliers',
        contactPerson: 'ABC Contact',
        email: 'vendor@abcsuppliers.com',
        phone: '9000000001',
        address: 'Mumbai, Maharashtra',
        gstin: 'GSTIN123456',
        category: 'Raw Material',
        status: 'active',
        riskScore: 100,
        userId: vendorUser._id,
      });
      console.log('  created ABC Suppliers vendor and linked user');
    } else {
      console.log('  skip: vendor already linked');
    }
  }

  // 4. Seed item catalog under this company
  for (const itemData of sampleItems) {
    const exists = await Item.findOne({ name: itemData.name, companyId: company._id });
    if (!exists) {
      await Item.create({ ...itemData, companyId: company._id, isActive: true });
      console.log(`  created item: ${itemData.name}`);
    } else {
      console.log(`  skip item (exists): ${itemData.name}`);
    }
  }

  console.log('\nSeed complete!');
  console.log(`Company ID: ${company._id}`);
  console.log('\nLogins (password: 123456):');
  usersToSeed.forEach((u) =>
    console.log(`  ${u.role.padEnd(10)} | ${u.email}`)
  );
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});