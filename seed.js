require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('./models/User');
const Vendor = require('./models/Vendor');
const Company = require('./models/Company');

const MONGO_URI = process.env.MONGO_URI;

const users = [
  { name: 'Admin User',      email: 'admin@procuredesk.com',     password: '123456', role: 'admin' },
  { name: 'Sarah Manager',   email: 'manager@procuredesk.com',   password: '123456', role: 'manager' },
  { name: 'Alex Approver',   email: 'approver1@procuredesk.com', password: '123456', role: 'approver' },
  { name: 'Beth Approver',   email: 'approver2@procuredesk.com', password: '123456', role: 'approver' },
  { name: 'ABC Vendor User', email: 'vendor@abcsuppliers.com',   password: '123456', role: 'vendor' },
];

const departments = [
  { name: 'Engineering', monthlyBudget: 50000, spent: 12400 },
  { name: 'Operations',  monthlyBudget: 30000, spent: 28100 },
  { name: 'Marketing',   monthlyBudget: 20000, spent: 7600  },
  { name: 'HR',          monthlyBudget: 15000, spent: 3200  },
  { name: 'Procurement', monthlyBudget: 40000, spent: 21000 },
];

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const company = await Company.findOne();

  for (const u of users) {
    const exists = await User.findOne({ email: u.email });
    if (exists) {
      console.log(`  skip (exists): ${u.email}`);
      continue;
    }
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(u.password, salt);
    await User.create({ ...u, password: hashed, company: company?._id });
    console.log(`  created: ${u.email} (${u.role})`);
  }

  const vendorUser = await User.findOne({ email: 'vendor@abcsuppliers.com' });
  if (vendorUser) {
    const abcVendor = await Vendor.findOne({ name: /ABC/i });
    if (abcVendor && !abcVendor.userId) {
      abcVendor.userId = vendorUser._id;
      await abcVendor.save();
      console.log('  linked vendor user → ABC Suppliers');
    } else if (!abcVendor) {
      console.log('  WARNING: ABC Suppliers vendor not found');
    } else {
      console.log('  skip: vendor already linked');
    }
  }

  if (company) {
    for (const dept of departments) {
      const exists = company.departments.find(
        (d) => d.name.toLowerCase() === dept.name.toLowerCase()
      );
      if (!exists) {
        company.departments.push(dept);
        console.log(`  added dept: ${dept.name}`);
      } else {
        console.log(`  skip dept (exists): ${dept.name}`);
      }
    }
    await company.save();
  } else {
    console.log('  WARNING: No company found. Run setupCompany first.');
  }

  console.log('\nSeed complete!');
  console.log('Logins:');
  users.forEach((u) => console.log(`  ${u.role.padEnd(10)} | ${u.email} / ${u.password}`));
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});