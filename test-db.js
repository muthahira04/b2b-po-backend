require('dotenv').config();
const mongoose = require('mongoose');

console.log('=== DATABASE DEBUG TEST ===');
console.log('Current directory:', __dirname);
console.log('MONGO_URI:', process.env.MONGO_URI);

async function testConnection() {
  try {
    console.log('Attempting to connect to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected successfully');
    
    const TestSchema = new mongoose.Schema({
      name: String,
      email: String
    });
    
    const Test = mongoose.model('Test', TestSchema);
    console.log('✅ Model created successfully');
    console.log('Test.findOne is a:', typeof Test.findOne);
    
    const result = await Test.findOne({ name: 'test' });
    console.log('✅ findOne works, result:', result);
    
    console.log('\n✅ All tests passed!');
    
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testConnection();