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
app.use(cors()); // Allow frontend to talk to backend
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

// 3. Catch-all for undefined routes - (MUST be after other routes)
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found'
  });
});

// ===== START THE SERVER =====
const server = app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
});

// ===== GRACEFUL SHUTDOWN =====
// Handle nodemon restarts and process termination
const gracefulShutdown = (signal) => {
  console.log(`\n🛑 ${signal} received. Closing server gracefully...`);

  server.close(() => {
    console.log('✅ Server closed. Process exiting...');
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error('⚠️ Forcing shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// Listen for termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // nodemon uses this