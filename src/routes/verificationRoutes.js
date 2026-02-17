// Verification Routes - API endpoints for photo/ID verification
const express = require('express');
const router = express.Router();
const verificationController = require('../controllers/verificationController');
const { verifyToken, requireApprovedAccount } = require('../middleware/authMiddleware');
const { requireAdmin, captureAdminContext } = require('../middleware/adminMiddleware');
const {
    uploadSelfie,
    uploadIdDocument,
    handleUploadError
} = require('../middleware/uploadMiddleware');

// ============================================================================
// USER ENDPOINTS
// ============================================================================

// All verification routes require authentication
router.use(verifyToken);

/**
 * @route   POST /api/verifications/photo
 * @desc    Upload selfie for photo verification
 * @access  Private (authenticated users)
 * @upload  Single file: 'selfie'
 */
router.post('/photo',
    uploadSelfie,
    handleUploadError,
    verificationController.uploadPhotoVerification
);

/**
 * @route   POST /api/verifications/id
 * @desc    Upload ID document for verification
 * @access  Private (authenticated users)
 * @upload  Single file: 'id_document'
 */
router.post('/id',
    uploadIdDocument,
    handleUploadError,
    verificationController.uploadIdVerification
);

/**
 * @route   GET /api/verifications/status
 * @desc    Get verification status for current user
 * @access  Private
 */
router.get('/status', verificationController.getVerificationStatus);

// ============================================================================
// ADMIN ENDPOINTS
// ============================================================================

/**
 * @route   GET /api/admin/verifications/pending
 * @desc    Get all pending verifications
 * @access  Admin only
 * @query   type (optional: 'photo' or 'id')
 */
router.get('/admin/pending',
    requireAdmin,
    captureAdminContext,
    verificationController.getPendingVerifications
);

/**
 * @route   POST /api/admin/verifications/:verificationId/approve
 * @desc    Approve a verification
 * @access  Admin only
 * @body    { notes?: string }
 */
router.post('/admin/:verificationId/approve',
    requireAdmin,
    captureAdminContext,
    verificationController.approveVerification
);

/**
 * @route   POST /api/admin/verifications/:verificationId/reject
 * @desc    Reject a verification
 * @access  Admin only
 * @body    { reason: string, notes?: string }
 */
router.post('/admin/:verificationId/reject',
    requireAdmin,
    captureAdminContext,
    verificationController.rejectVerification
);

/**
 * @route   GET /api/admin/verifications/stats
 * @desc    Get verification statistics
 * @access  Admin only
 */
router.get('/admin/stats',
    requireAdmin,
    verificationController.getVerificationStats
);

module.exports = router;
