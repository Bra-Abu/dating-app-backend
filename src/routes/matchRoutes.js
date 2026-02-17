// Match Routes - API endpoints for matching functionality
const express = require('express');
const router = express.Router();
const matchController = require('../controllers/matchController');
const { verifyToken, requireApprovedAccount } = require('../middleware/authMiddleware');

// All match routes require authentication and approved account
router.use(verifyToken);
router.use(requireApprovedAccount);

/**
 * @route   GET /api/matches/suggestions
 * @desc    Get ranked match suggestions based on compatibility
 * @access  Private (approved accounts only)
 * @query   limit (default: 10)
 */
router.get('/suggestions', matchController.getMatchSuggestions);

/**
 * @route   POST /api/matches/like/:userId
 * @desc    Like a user's profile
 * @access  Private
 */
router.post('/like/:userId', matchController.likeUser);

/**
 * @route   POST /api/matches/pass/:userId
 * @desc    Pass on a user's profile
 * @access  Private
 */
router.post('/pass/:userId', matchController.passUser);

/**
 * @route   GET /api/matches/mutual
 * @desc    Get all mutual matches
 * @access  Private
 */
router.get('/mutual', matchController.getMutualMatches);

/**
 * @route   DELETE /api/matches/unmatch/:userId
 * @desc    Unmatch with a user
 * @access  Private
 */
router.delete('/unmatch/:userId', matchController.unmatchUser);

/**
 * @route   GET /api/matches/history
 * @desc    Get match history (all likes and passes)
 * @access  Private
 * @query   page, limit
 */
router.get('/history', matchController.getMatchHistory);

/**
 * @route   GET /api/matches/stats
 * @desc    Get match statistics
 * @access  Private
 */
router.get('/stats', matchController.getMatchStats);

module.exports = router;
