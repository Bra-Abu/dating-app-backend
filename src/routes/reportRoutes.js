// Report Routes - API endpoints for reports and blocks
const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { verifyToken, requireApprovedAccount } = require('../middleware/authMiddleware');
const { requireAdmin, captureAdminContext } = require('../middleware/adminMiddleware');

// All routes require authentication
router.use(verifyToken);
router.use(requireApprovedAccount);

// ============================================================================
// USER ENDPOINTS - Reports
// ============================================================================

/**
 * @route   POST /api/reports/create
 * @desc    Create a report against another user
 * @access  Private
 * @body    { reportedUserId, reportType, description, evidenceUrls }
 */
router.post('/create', reportController.createReport);

/**
 * @route   GET /api/reports/my-reports
 * @desc    Get all reports created by current user
 * @access  Private
 */
router.get('/my-reports', reportController.getMyReports);

// ============================================================================
// USER ENDPOINTS - Blocks
// ============================================================================

/**
 * @route   POST /api/blocks/block/:userId
 * @desc    Block a user
 * @access  Private
 * @body    { reason?: string }
 */
router.post('/blocks/block/:userId', reportController.blockUser);

/**
 * @route   DELETE /api/blocks/unblock/:userId
 * @desc    Unblock a user
 * @access  Private
 */
router.delete('/blocks/unblock/:userId', reportController.unblockUser);

/**
 * @route   GET /api/blocks/list
 * @desc    Get list of blocked users
 * @access  Private
 */
router.get('/blocks/list', reportController.getBlockedUsers);

/**
 * @route   GET /api/blocks/check/:userId
 * @desc    Check if a user is blocked
 * @access  Private
 */
router.get('/blocks/check/:userId', reportController.checkIfBlocked);

// ============================================================================
// ADMIN ENDPOINTS
// ============================================================================

/**
 * @route   GET /api/reports/admin/all
 * @desc    Get all reports
 * @access  Admin only
 * @query   status, reportType, page, limit
 */
router.get('/admin/all',
    requireAdmin,
    captureAdminContext,
    reportController.getAllReports
);

/**
 * @route   POST /api/reports/admin/:reportId/resolve
 * @desc    Resolve a report
 * @access  Admin only
 * @body    { actionTaken: string, notes?: string }
 */
router.post('/admin/:reportId/resolve',
    requireAdmin,
    captureAdminContext,
    reportController.resolveReport
);

/**
 * @route   POST /api/reports/admin/:reportId/dismiss
 * @desc    Dismiss a report
 * @access  Admin only
 * @body    { reason: string }
 */
router.post('/admin/:reportId/dismiss',
    requireAdmin,
    captureAdminContext,
    reportController.dismissReport
);

module.exports = router;
