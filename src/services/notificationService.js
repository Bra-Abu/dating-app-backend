// Notification Service - Create and manage notifications
const pool = require('../config/database');

class NotificationService {
    /**
     * Create a notification
     * @param {string} userId - User to notify
     * @param {string} notificationType - Type of notification
     * @param {string} title - Notification title
     * @param {string} message - Notification message
     * @param {Object} relatedEntities - Related user/match/message IDs
     */
    async createNotification(userId, notificationType, title, message, relatedEntities = {}) {
        try {
            const query = `
                INSERT INTO notifications (
                    user_id,
                    notification_type,
                    title,
                    message,
                    related_user_id,
                    related_match_id,
                    related_message_id
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `;

            const result = await pool.query(query, [
                userId,
                notificationType,
                title,
                message,
                relatedEntities.userId || null,
                relatedEntities.matchId || null,
                relatedEntities.messageId || null
            ]);

            return result.rows[0];

        } catch (error) {
            console.error('Error creating notification:', error);
            return null;
        }
    }

    /**
     * Notify user of new match
     */
    async notifyNewMatch(userId, matchedUserId, matchId) {
        try {
            // Get matched user's name
            const profileQuery = 'SELECT first_name, last_name FROM profiles WHERE user_id = $1';
            const profileResult = await pool.query(profileQuery, [matchedUserId]);

            if (profileResult.rows.length > 0) {
                const profile = profileResult.rows[0];
                const name = `${profile.first_name} ${profile.last_name}`;

                await this.createNotification(
                    userId,
                    'new_match',
                    'It\'s a Match! 🎉',
                    `You matched with ${name}! Start a conversation now.`,
                    { userId: matchedUserId, matchId }
                );
            }
        } catch (error) {
            console.error('Error notifying new match:', error);
        }
    }

    /**
     * Notify user of new message
     */
    async notifyNewMessage(userId, senderId, messageId, matchId) {
        try {
            const profileQuery = 'SELECT first_name FROM profiles WHERE user_id = $1';
            const profileResult = await pool.query(profileQuery, [senderId]);

            if (profileResult.rows.length > 0) {
                const senderName = profileResult.rows[0].first_name;

                await this.createNotification(
                    userId,
                    'new_message',
                    'New Message',
                    `${senderName} sent you a message`,
                    { userId: senderId, messageId, matchId }
                );
            }
        } catch (error) {
            console.error('Error notifying new message:', error);
        }
    }

    /**
     * Notify user their profile was approved
     */
    async notifyProfileApproved(userId) {
        await this.createNotification(
            userId,
            'profile_approved',
            'Profile Approved ✅',
            'Your profile has been approved and is now visible to other users!'
        );
    }

    /**
     * Notify user their profile was rejected
     */
    async notifyProfileRejected(userId, reason) {
        await this.createNotification(
            userId,
            'profile_rejected',
            'Profile Needs Attention',
            `Your profile could not be approved: ${reason}. Please update and resubmit.`
        );
    }

    /**
     * Notify user their account was approved
     */
    async notifyAccountApproved(userId) {
        await this.createNotification(
            userId,
            'profile_approved',
            'Account Approved! 🎉',
            'Your account has been approved. You can now create your profile and start matching!'
        );
    }

    /**
     * Notify user verification was approved
     */
    async notifyVerificationApproved(userId, verificationType) {
        const types = {
            'photo': 'Photo Verification',
            'id': 'ID Verification'
        };

        await this.createNotification(
            userId,
            'verification_approved',
            `${types[verificationType]} Approved ✅`,
            `Your ${types[verificationType].toLowerCase()} has been approved. You now have a verified badge!`
        );
    }

    /**
     * Notify user verification was rejected
     */
    async notifyVerificationRejected(userId, verificationType, reason) {
        const types = {
            'photo': 'Photo Verification',
            'id': 'ID Verification'
        };

        await this.createNotification(
            userId,
            'verification_rejected',
            `${types[verificationType]} Needs Attention`,
            `Your ${types[verificationType].toLowerCase()} could not be approved: ${reason}. Please resubmit.`
        );
    }

    /**
     * Notify user they received a like
     */
    async notifyNewLike(userId, likerId) {
        try {
            const profileQuery = 'SELECT first_name FROM profiles WHERE user_id = $1';
            const profileResult = await pool.query(profileQuery, [likerId]);

            if (profileResult.rows.length > 0) {
                const likerName = profileResult.rows[0].first_name;

                await this.createNotification(
                    userId,
                    'new_like',
                    'Someone Likes You! 💚',
                    `${likerName} liked your profile`,
                    { userId: likerId }
                );
            }
        } catch (error) {
            console.error('Error notifying new like:', error);
        }
    }

    /**
     * Notify user they need verification
     */
    async notifyVerificationNeeded(userId) {
        await this.createNotification(
            userId,
            'verification_needed',
            'Verify Your Profile',
            'Increase your chances of matching by verifying your profile with a selfie and ID document.'
        );
    }

    /**
     * Notify user their account was suspended
     */
    async notifyAccountSuspended(userId, reason) {
        await this.createNotification(
            userId,
            'account_suspended',
            'Account Suspended',
            `Your account has been suspended: ${reason}. Please contact support if you believe this is an error.`
        );
    }

    /**
     * Get all notifications for a user
     */
    async getUserNotifications(userId, limit = 50, offset = 0) {
        try {
            const query = `
                SELECT
                    n.*,
                    p.first_name,
                    p.last_name,
                    p.photo_urls
                FROM notifications n
                LEFT JOIN profiles p ON n.related_user_id = p.user_id
                WHERE n.user_id = $1
                ORDER BY n.created_at DESC
                LIMIT $2 OFFSET $3
            `;

            const result = await pool.query(query, [userId, limit, offset]);

            return result.rows.map(row => ({
                id: row.id,
                type: row.notification_type,
                title: row.title,
                message: row.message,
                isRead: row.is_read,
                readAt: row.read_at,
                createdAt: row.created_at,
                relatedUser: row.first_name ? {
                    userId: row.related_user_id,
                    firstName: row.first_name,
                    lastName: row.last_name,
                    photoUrls: row.photo_urls
                } : null
            }));

        } catch (error) {
            console.error('Error getting user notifications:', error);
            return [];
        }
    }

    /**
     * Get unread notification count
     */
    async getUnreadCount(userId) {
        try {
            const query = 'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false';
            const result = await pool.query(query, [userId]);
            return parseInt(result.rows[0].count);
        } catch (error) {
            console.error('Error getting unread count:', error);
            return 0;
        }
    }

    /**
     * Mark notification as read
     */
    async markAsRead(notificationId, userId) {
        try {
            const query = `
                UPDATE notifications
                SET is_read = true,
                    read_at = CURRENT_TIMESTAMP
                WHERE id = $1 AND user_id = $2
                RETURNING *
            `;

            const result = await pool.query(query, [notificationId, userId]);
            return result.rows.length > 0;
        } catch (error) {
            console.error('Error marking notification as read:', error);
            return false;
        }
    }

    /**
     * Mark all notifications as read
     */
    async markAllAsRead(userId) {
        try {
            const query = `
                UPDATE notifications
                SET is_read = true,
                    read_at = CURRENT_TIMESTAMP
                WHERE user_id = $1 AND is_read = false
            `;

            await pool.query(query, [userId]);
            return true;
        } catch (error) {
            console.error('Error marking all as read:', error);
            return false;
        }
    }

    /**
     * Delete notification
     */
    async deleteNotification(notificationId, userId) {
        try {
            const query = 'DELETE FROM notifications WHERE id = $1 AND user_id = $2';
            const result = await pool.query(query, [notificationId, userId]);
            return result.rowCount > 0;
        } catch (error) {
            console.error('Error deleting notification:', error);
            return false;
        }
    }
}

module.exports = new NotificationService();
