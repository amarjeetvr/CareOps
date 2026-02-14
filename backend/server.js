require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const { errorHandler } = require('./middleware/error');
const pool = require('./db');
const createTables = require('./initDb');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// PostgreSQL Connection & Table Init
(async () => {
  try {
    const client = await pool.connect();
    console.log('PostgreSQL connected successfully');
    client.release();
    await createTables();
    // Start cron jobs after DB connection
    require('./cron');
  } catch (err) {
    console.error('PostgreSQL connection error:', err);
  }
})();

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'CareOps Backend API', version: '1.0.0' });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/workspace', require('./routes/workspace'));
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/services', require('./routes/services'));
app.use('/api/forms', require('./routes/forms'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/inbox', require('./routes/inbox'));
app.use('/api/staff', require('./routes/staff'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/onboarding', require('./routes/onboarding'));
app.use('/api/public', require('./routes/public'));

// Error handler (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
