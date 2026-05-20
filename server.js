const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const app = express();

const allowedOrigins = [
  'http://localhost:5173',
  'https://b2b-po-frontend.vercel.app', // update this after Vercel deploys
];

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (Render health checks, mobile apps)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(morgan('dev'));
app.use(express.json());

// Disable caching for all API responses
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'B2B PO Management API is running' });
});

// Debug route — remove after presentation
app.get('/api/debug/users', async (req, res) => {
  const User = require('./models/User');
  const users = await User.find({}, 'name email role companyId');
  res.json(users);
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
    console.log('MongoDB Connected');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => console.error('DB Connection Error:', err));