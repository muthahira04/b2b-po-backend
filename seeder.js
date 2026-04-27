const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const User = require('./models/User');
const Company = require('./models/Company');

const seedUsers = async () => {
  try {
    console.log('Connecting to MongoDB...');
    console.log('MONGO_URI:', process.env.MONGO_URI ? 'Found ✓' : 'Missing ✗');
    
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB ✓');

    // Get existing company
    console.log('Looking for company: ProcureDesk Corp');
    const company = await Company.findOne({ name: 'ProcureDesk Corp' });
    
    if (!company) {
      console.log('❌ Company not found. Available companies:');
      const allCompanies = await Company.find({});
      console.log(allCompanies.map(c => c.name));
      process.exit(1);
    }
    
    console.log(`Found company: ${company.name} (${company._id}) ✓`);

    // Delete existing test users
    const emailsToDelete = [
      'manager@procuredesk.com',
      'approver1@procuredesk.com',
      'approver2@procuredesk.com'
    ];
    
    const deleteResult = await User.deleteMany({ email: { $in: emailsToDelete } });
    console.log(`Deleted ${deleteResult.deletedCount} existing users`);

    // Create users with different roles
    const usersToCreate = [
      {
        name: 'Manager User',
        email: 'manager@procuredesk.com',
        password: '123456',
        role: 'manager',
        companyId: company._id
      },
      {
        name: 'Approver One',
        email: 'approver1@procuredesk.com',
        password: '123456',
        role: 'approver',
        companyId: company._id
      },
      {
        name: 'Approver Two',
        email: 'approver2@procuredesk.com',
        password: '123456',
        role: 'approver',
        companyId: company._id
      }
    ];

    // Hash passwords and save
    for (const userData of usersToCreate) {
      const salt = await bcrypt.genSalt(10);
      userData.password = await bcrypt.hash(userData.password, salt);
      
      const user = new User(userData);
      await user.save();
      console.log(`✓ Created user: ${user.email} (${user.role})`);
    }

    console.log('\n Seed completed successfully!');
    console.log('\n Login credentials:');
    console.log('Admin:     admin@procuredesk.com / 123456');
    console.log('Manager:   manager@procuredesk.com / 123456');
    console.log('Approver1: approver1@procuredesk.com / 123456');
    console.log('Approver2: approver2@procuredesk.com / 123456');
    
    process.exit(0);
  } catch (error) {
    console.error(' Error during seeding:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
};

// Run the seed function
seedUsers();