// Authentication routes
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');

/**
 * @route   POST /api/auth/verify
 * @desc    Verify Firebase token and login existing user
 * @access  Public
 * @body    { idToken: string }
 */
router.post('/verify', authController.verify);

/**
 * @route   POST /api/auth/register
 * @desc    Register new user with invite code
 * @access  Public
 * @body    { idToken: string, inviteCode: string }
 */
router.post('/register', authController.register);

/**
 * @route   POST /api/auth/validate-invite
 * @desc    Validate an invite code (for registration flow)
 * @access  Public
 * @body    { code: string }
 */
router.post('/validate-invite', authController.validateInvite);

/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user info
 * @access  Private (requires authentication)
 */
router.get('/me', verifyToken, authController.getCurrentUser);

module.exports = router;