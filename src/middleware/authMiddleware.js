// Middleware to verify Firebase tokens
const admin = require('../config/firebase');
const pool = require('../config/database');

/**
 * Verify Firebase ID token and attach user to request
 * Does NOT check account status - use requireApprovedAccount for that
 */
const verifyToken = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    // Extract the token (remove "Bearer " prefix)
    const token = authHeader.split('Bearer ')[1];

    // Verify the token with Firebase
    const decodedToken = await admin.auth().verifyIdToken(token);

    // Get user from database using Firebase UID
    const result = await pool.query(
      'SELECT id, firebase_uid, phone_number, email, status, account_type FROM users WHERE firebase_uid = $1',
      [decodedToken.uid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found in database'
      });
    }

    const user = result.rows[0];

    // Add user info to request object for use in controllers
    req.user = {
      id: user.id,                    // Database user ID
      firebaseUid: user.firebase_uid,
      phoneNumber: user.phone_number,
      email: user.email,
      status: user.status,
      account_type: user.account_type  // 'user', 'admin', 'super_admin'
    };

    next(); // Continue to the next middleware/route
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token'
    });
  }
};

/**
 * Middleware to ensure user account is approved
 * Use this AFTER verifyToken for routes that require active accounts
 */
const requireApprovedAccount = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  // Allow admins regardless of status
  if (req.user.account_type === 'admin' || req.user.account_type === 'super_admin') {
    return next();
  }

  // Check if regular user account is active
  if (req.user.status === 'pending_approval') {
    return res.status(403).json({
      success: false,
      error: 'Your account is pending admin approval. Please wait for approval before accessing this feature.',
      accountStatus: 'pending_approval'
    });
  }

  if (req.user.status === 'suspended' || req.user.status === 'banned') {
    return res.status(403).json({
      success: false,
      error: 'Your account has been suspended. Please contact support.',
      accountStatus: req.user.status
    });
  }

  if (req.user.status !== 'active') {
    return res.status(403).json({
      success: false,
      error: 'Account is not active',
      accountStatus: req.user.status
    });
  }

  next();
};

/**
 * Middleware to check if user is banned or deleted
 * This is a softer check than requireApprovedAccount
 */
const checkNotBanned = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  if (req.user.status === 'banned' || req.user.status === 'deleted') {
    return res.status(403).json({
      success: false,
      error: 'Your account has been banned',
      accountStatus: req.user.status
    });
  }

  next();
};

module.exports = {
  verifyToken,
  requireApprovedAccount,
  checkNotBanned
};