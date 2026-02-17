// Admin Routes - API endpoints for admin dashboard
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyToken } = require('../middleware/authMiddleware');
const { requireAdmin, requireSuperAdmin, captureAdminContext } = require('../middleware/adminMiddleware');

// All admin routes require authentication and admin role
router.use(verifyToken);
router.use(requireAdmin);
router.use(captureAdminContext);

// ============================================================================
// USER MANAGEMENT
// ============================================================================

/**
 * @route   GET /api/admin/users/pending
 * @desc    Get all users pending approval
 * @access  Admin
 */
router.get('/users/pending', adminController.getPendingUsers);

/**
 * @route   POST /api/admin/users/:userId/approve
 * @desc    Approve a pending user
 * @access  Admin
 * @body    { reason?: string }
 */
router.post('/users/:userId/approve', adminController.approveUser);

/**
 * @route   POST /api/admin/users/:userId/reject
 * @desc    Reject a pending user
 * @access  Admin
 * @body    { reason: string }
 */
router.post('/users/:userId/reject', adminController.rejectUser);

/**
 * @route   POST /api/admin/users/:userId/suspend
 * @desc    Suspend a user account
 * @access  Admin
 * @body    { reason: string, duration?: number }
 */
router.post('/users/:userId/suspend', adminController.suspendUser);

/**
 * @route   POST /api/admin/users/:userId/unsuspend
 * @desc    Unsuspend a user account
 * @access  Admin
 * @body    { reason?: string }
 */
router.post('/users/:userId/unsuspend', adminController.unsuspendUser);

/**
 * @route   GET /api/admin/users
 * @desc    Get all users with filters
 * @access  Admin
 * @query   status, account_type, page, limit
 */
router.get('/users', adminController.getAllUsers);

/**
 * @route   GET /api/admin/users/:userId
 * @desc    Get detailed user information
 * @access  Admin
 */
router.get('/users/:userId', adminController.getUserDetails);

// ============================================================================
// PROFILE MODERATION
// ============================================================================

/**
 * @route   GET /api/admin/profiles/pending
 * @desc    Get profiles pending moderation
 * @access  Admin
 */
router.get('/profiles/pending', adminController.getPendingProfiles);

/**
 * @route   POST /api/admin/profiles/:profileId/approve
 * @desc    Approve a profile
 * @access  Admin
 * @body    { notes?: string }
 */
router.post('/profiles/:profileId/approve', adminController.approveProfile);

/**
 * @route   POST /api/admin/profiles/:profileId/reject
 * @desc    Reject a profile
 * @access  Admin
 * @body    { reason: string }
 */
router.post('/profiles/:profileId/reject', adminController.rejectProfile);

// ============================================================================
// STATISTICS
// ============================================================================

/**
 * @route   GET /api/admin/stats/overview
 * @desc    Get platform overview statistics
 * @access  Admin
 */
router.get('/stats/overview', adminController.getOverviewStats);

/**
 * @route   GET /api/admin/activity/suspicious
 * @desc    Get suspicious activity
 * @access  Admin
 */
router.get('/activity/suspicious', adminController.getSuspiciousActivity);

// ============================================================================
// AUDIT LOG
// ============================================================================

/**
 * @route   GET /api/admin/actions
 * @desc    Get admin action logs
 * @access  Admin
 * @query   admin_id, action_type, page, limit
 */
router.get('/actions', adminController.getAdminActions);

// ============================================================================
// PROFILE MODERATION (Phase 2, Task 7)
// ============================================================================
// TODO: Add profile moderation endpoints

// ============================================================================
// VERIFICATION REVIEW (Phase 4) - ✅ COMPLETE
// ============================================================================
// Verification endpoints are in verificationRoutes.js:
// - GET /api/verifications/admin/pending
// - POST /api/verifications/admin/:id/approve
// - POST /api/verifications/admin/:id/reject
// - GET /api/verifications/admin/stats

// ============================================================================
// REPORT MANAGEMENT (Phase 6)
// ============================================================================
// TODO: Add report management endpoints

// ============================================================================
// STATISTICS (Phase 7)
// ============================================================================
// TODO: Add statistics endpoints

module.exports = router;
