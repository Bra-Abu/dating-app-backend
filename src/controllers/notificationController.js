// Notification Controller - Handle notification endpoints
const notificationService = require('../services/notificationService');

class NotificationController {
    /**
     * GET /api/notifications
     * Get all notifications for current user
     */
    async getNotifications(req, res) {
        try {
            const userId = req.user.id;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 50;
            const offset = (page - 1) * limit;

            const notifications = await notificationService.getUserNotifications(userId, limit, offset);
            const unreadCount = await notificationService.getUnreadCount(userId);

            res.json({
                success: true,
                data: notifications,
                unreadCount,
                pagination: {
                    page,
                    limit,
                    count: notifications.length
                }
            });

        } catch (error) {
            console.error('Error getting notifications:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get notifications'
            });
        }
    }

    /**
     * GET /api/notifications/unread-count
     * Get unread notification count
     */
    async getUnreadCount(req, res) {
        try {
            const userId = req.user.id;
            const count = await notificationService.getUnreadCount(userId);

            res.json({
                success: true,
                data: {
                    unreadCount: count
                }
            });

        } catch (error) {
            console.error('Error getting unread count:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get unread count'
            });
        }
    }

    /**
     * PATCH /api/notifications/:notificationId/read
     * Mark a notification as read
     */
    async markAsRead(req, res) {
        try {
            const userId = req.user.id;
            const { notificationId } = req.params;

            const success = await notificationService.markAsRead(notificationId, userId);

            if (!success) {
                return res.status(404).json({
                    success: false,
                    error: 'Notification not found'
                });
            }

            res.json({
                success: true,
                message: 'Notification marked as read'
            });

        } catch (error) {
            console.error('Error marking notification as read:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to mark notification as read'
            });
        }
    }

    /**
     * PATCH /api/notifications/mark-all-read
     * Mark all notifications as read
     */
    async markAllAsRead(req, res) {
        try {
            const userId = req.user.id;

            await notificationService.markAllAsRead(userId);

            res.json({
                success: true,
                message: 'All notifications marked as read'
            });

        } catch (error) {
            console.error('Error marking all notifications as read:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to mark notifications as read'
            });
        }
    }

    /**
     * DELETE /api/notifications/:notificationId
     * Delete a notification
     */
    async deleteNotification(req, res) {
        try {
            const userId = req.user.id;
            const { notificationId } = req.params;

            const success = await notificationService.deleteNotification(notificationId, userId);

            if (!success) {
                return res.status(404).json({
                    success: false,
                    error: 'Notification not found'
                });
            }

            res.json({
                success: true,
                message: 'Notification deleted'
            });

        } catch (error) {
            console.error('Error deleting notification:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to delete notification'
            });
        }
    }
}

module.exports = new NotificationController();
