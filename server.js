const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'B2B PO Management API is running' });
});
app.get('/api/debug/users', async (req, res) => {
  const User = require('./models/User');
  const users = await User.find({}, 'name email role companyId');
  res.json(users);
});
app.get('/api/debug/users', async (req, res) => {
  const User = require('./models/User');
  const users = await User.find({}, 'name email role companyId');
  res.json(users);
});
// Disable caching for all API responses
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/vendors', require('./routes/vendors'));
app.use('/api/items', require('./routes/items'));
app.use('/api/po', require('./routes/po'));
app.use('/api/company', require('./routes/company'));
// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log(' MongoDB Connected');
    app.listen(PORT, () => console.log(` Server running on port ${PORT}`));
  })
  .catch((err) => console.error(' DB Connection Error:', err));