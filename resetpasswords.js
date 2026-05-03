require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const hash = await bcrypt.hash('123456', 10);
  await User.updateMany(
    { email: { $in: ['manager@procuredesk.com', 'approver1@procuredesk.com', 'approver2@procuredesk.com', 'vendor@abcsuppliers.com'] } },
    { $set: { password: hash } }
  );
  console.log('Passwords reset successfully');
  mongoose.disconnect();
});