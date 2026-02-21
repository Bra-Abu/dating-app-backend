// Invite Routes - API endpoints for invite code management
const express = require('express');
const router = express.Router();
const inviteController = require('../controllers/inviteController');
const { verifyToken } = require('../middleware/authMiddleware');

// All invite routes require authentication
router.use(verifyToken);

/**
 * @route   GET /api/invites/my-code
 * @desc    Get current user's invite code
 * @access  Private (authenticated users)
 */
router.get('/my-code', inviteController.getMyInviteCode);
router.get('/all-codes', inviteController.getAllMyCodes);

/**
 * @route   POST /api/invites/validate
 * @desc    Validate an invite code (public endpoint during registration)
 * @access  Public (but typically called before registration)
 * @body    { code: string }
 */
// Note: This route is duplicated in authRoutes for public access during registration

/**
 * @route   GET /api/invites/stats
 * @desc    Get invite code usage statistics
 * @access  Private
 */
router.get('/stats', inviteController.getInviteStats);

/**
 * @route   GET /api/invites/invited-users
 * @desc    Get list of users invited by current user
 * @access  Private
 */
router.get('/invited-users', inviteController.getInvitedUsers);

/**
 * @route   POST /api/invites/generate
 * @desc    Generate a new invite code
 * @access  Private
 */
router.post('/generate', inviteController.generateNewInviteCode);

/**
 * @route   POST /api/invites/deactivate
 * @desc    Deactivate an invite code
 * @access  Private
 * @body    { code: string }
 */
router.post('/deactivate', inviteController.deactivateInviteCode);

module.exports = router;
