// Import the tools we need
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');

// Load environment variables from .env file
dotenv.config();

// Create the Express app
const app = express();

// Get the port from .env file, or use 5000 as default
const PORT = process.env.PORT || 5000;

// Middleware - these run on every request
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, true); // Allow all for now during testing
  },
  credentials: true
}));
app.use(express.json()); // Parse JSON data from requests

// Apply rate limiting to all API routes
const { apiLimiter } = require('./middleware/rateLimiter');
app.use('/api/', apiLimiter);

// Serve static files (uploaded images)
app.use('/uploads', express.static('uploads'));

// ===== ROUTES =====

// 1. Health check route - (Good practice to put this early)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Server is running!',
    timestamp: new Date().toISOString()
  });
});

// 2. Import and Use Feature Routes
const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const inviteRoutes = require('./routes/inviteRoutes');
const adminRoutes = require('./routes/adminRoutes');
const matchRoutes = require('./routes/matchRoutes');
const messageRoutes = require('./routes/messageRoutes');
const verificationRoutes = require('./routes/verificationRoutes');
const reportRoutes = require('./routes/reportRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/invites', inviteRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/verifications', verificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);

// Setup route - promotes a user to admin (one-time use, protected by secret)
app.post('/api/setup/make-admin', async (req, res) => {
  const { phone, secret } = req.body;
  const SETUP_SECRET = process.env.SETUP_SECRET || 'setup-secret-2024';
  if (secret !== SETUP_SECRET) return res.status(403).json({ error: 'Invalid secret' });
  try {
    const pool = require('./config/database');
    const result = await pool.query(
      `UPDATE users SET status = 'active', account_type = 'admin', approved_at = CURRENT_TIMESTAMP
       WHERE phone_number = $1 RETURNING id, phone_number, status, account_type`,
      [phone]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Catch-all for undefined routes - (MUST be after other routes)
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found'
  });
});

// ===== AUTO MIGRATE & START THE SERVER =====
const startServer = async () => {
  // Run database migration on every startup (safe - uses CREATE IF NOT EXISTS)
  if (process.env.DATABASE_URL) {
    try {
      const migrate = require('../scripts/migrate');
      await migrate();
    } catch (err) {
      console.error('⚠️ Migration warning:', err.message);
      // Don't crash - tables may already exist
    }
  }

  const server = app.listen(PORT, () => {
    console.log(`✅ Server is running on http://localhost:${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/health`);
  });

  // ===== GRACEFUL SHUTDOWN =====
  const gracefulShutdown = (signal) => {
    console.log(`\n🛑 ${signal} received. Closing server gracefully...`);
    server.close(() => {
      console.log('✅ Server closed. Process exiting...');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2'));

  return server;
};

startServer();

