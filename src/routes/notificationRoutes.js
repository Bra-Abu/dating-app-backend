// Notification Routes - API endpoints for notifications
const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { verifyToken } = require('../middleware/authMiddleware');

// All notification routes require authentication
router.use(verifyToken);

/**
 * @route   GET /api/notifications
 * @desc    Get all notifications for current user
 * @access  Private
 * @query   page, limit
 */
router.get('/', notificationController.getNotifications);

/**
 * @route   GET /api/notifications/unread-count
 * @desc    Get unread notification count
 * @access  Private
 */
router.get('/unread-count', notificationController.getUnreadCount);

/**
 * @route   PATCH /api/notifications/:notificationId/read
 * @desc    Mark a notification as read
 * @access  Private
 */
router.patch('/:notificationId/read', notificationController.markAsRead);

/**
 * @route   PATCH /api/notifications/mark-all-read
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.patch('/mark-all-read', notificationController.markAllAsRead);

/**
 * @route   DELETE /api/notifications/:notificationId
 * @desc    Delete a notification
 * @access  Private
 */
router.delete('/:notificationId', notificationController.deleteNotification);

module.exports = router;
