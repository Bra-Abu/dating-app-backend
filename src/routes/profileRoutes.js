// Profile Routes - Defines all profile-related endpoints
const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const { verifyToken, requireApprovedAccount } = require('../middleware/authMiddleware');
const { uploadMultipleProfilePhotos, handleUploadError } = require('../middleware/uploadMiddleware');
const { validateRequest, profileUpdateSchema } = require('../utils/validators');

// All routes require authentication
router.use(verifyToken);

/**
 * @route   POST /api/profiles
 * @desc    Create a new profile
 * @access  Private (authenticated users, pending approval OK)
 */
router.post('/',
    uploadMultipleProfilePhotos,
    handleUploadError,
    profileController.createProfile
);

/**
 * @route   GET /api/profiles/me
 * @desc    Get current user's own profile
 * @access  Private
 */
router.get('/me', profileController.getMyProfile);

/**
 * @route   PUT /api/profiles/me
 * @desc    Update current user's profile
 * @access  Private
 */
router.put('/me',
    validateRequest(profileUpdateSchema),
    profileController.updateProfile
);

/**
 * @route   GET /api/profiles
 * @desc    Browse profiles for matching
 * @access  Private (requires approved account)
 */
router.get('/',
    requireApprovedAccount,
    profileController.browseProfiles
);

/**
 * @route   GET /api/profiles/:userId
 * @desc    Get a specific user's profile
 * @access  Private (requires approved account)
 */
router.get('/:userId',
    requireApprovedAccount,
    profileController.getProfile
);

module.exports = router;