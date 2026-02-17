// Message Routes - API endpoints for messaging
const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { verifyToken, requireApprovedAccount } = require('../middleware/authMiddleware');

// All message routes require authentication and approved account
router.use(verifyToken);
router.use(requireApprovedAccount);

/**
 * @route   POST /api/messages/send
 * @desc    Send a message to a matched user
 * @access  Private
 * @body    { receiverId: string, message: string }
 */
router.post('/send', messageController.sendMessage);

/**
 * @route   GET /api/messages/conversations
 * @desc    Get all conversations
 * @access  Private
 */
router.get('/conversations', messageController.getConversations);

/**
 * @route   GET /api/messages/conversation/:matchId
 * @desc    Get message history for a specific match
 * @access  Private
 * @query   page, limit, before (timestamp)
 */
router.get('/conversation/:matchId', messageController.getConversation);

/**
 * @route   PATCH /api/messages/:messageId/read
 * @desc    Mark a message as read
 * @access  Private
 */
router.patch('/:messageId/read', messageController.markAsRead);

/**
 * @route   GET /api/messages/new
 * @desc    Get new messages since timestamp (for polling)
 * @access  Private
 * @query   since (timestamp)
 */
router.get('/new', messageController.getNewMessages);

/**
 * @route   DELETE /api/messages/:messageId
 * @desc    Delete a message
 * @access  Private
 */
router.delete('/:messageId', messageController.deleteMessage);

module.exports = router;
