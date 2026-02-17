// Activity Service - Track and monitor user activity for anti-fake measures
const pool = require('../config/database');

class ActivityService {
    /**
     * Log user activity
     * @param {string} userId - User ID
     * @param {string} activityType - Type of activity
     * @param {string} targetUserId - Target user (optional)
     * @param {Object} metadata - Additional data
     * @param {string} ipAddress - IP address
     * @param {string} userAgent - User agent string
     */
    async logActivity(userId, activityType, targetUserId = null, metadata = {}, ipAddress = null, userAgent = null) {
        try {
            const query = `
                INSERT INTO activity_log (
                    user_id,
                    activity_type,
                    target_user_id,
                    ip_address,
                    user_agent,
                    device_info,
                    location_info
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `;

            const result = await pool.query(query, [
                userId,
                activityType,
                targetUserId,
                ipAddress,
                userAgent,
                metadata.deviceInfo ? JSON.stringify(metadata.deviceInfo) : null,
                metadata.locationInfo ? JSON.stringify(metadata.locationInfo) : null
            ]);

            // Check for suspicious patterns after logging
            await this.detectSuspiciousActivity(userId);

            return result.rows[0];

        } catch (error) {
            console.error('Error logging activity:', error);
            // Don't throw - activity logging shouldn't break the main flow
            return null;
        }
    }

    /**
     * Detect suspicious activity patterns
     * @param {string} userId - User ID to check
     * @returns {Promise<Object>} Suspicious activity details
     */
    async detectSuspiciousActivity(userId) {
        try {
            const suspicious = {
                isSuspicious: false,
                reasons: [],
                severity: 'low' // low, medium, high
            };

            // Check 1: Rapid likes (bot behavior)
            const rapidLikesQuery = `
                SELECT COUNT(*) as count
                FROM activity_log
                WHERE user_id = $1
                  AND activity_type = 'like'
                  AND created_at > NOW() - INTERVAL '1 hour'
            `;
            const rapidLikesResult = await pool.query(rapidLikesQuery, [userId]);
            const likesLastHour = parseInt(rapidLikesResult.rows[0].count);

            if (likesLastHour > 50) {
                suspicious.isSuspicious = true;
                suspicious.reasons.push(`Excessive likes: ${likesLastHour} in last hour`);
                suspicious.severity = 'high';

                await this.flagSuspiciousActivity(userId, 'excessive_likes', `${likesLastHour} likes in 1 hour`);
            }

            // Check 2: Multiple accounts from same IP
            const multipleAccountsQuery = `
                SELECT DISTINCT user_id, COUNT(DISTINCT user_id) as user_count
                FROM activity_log
                WHERE ip_address = (
                    SELECT ip_address FROM activity_log
                    WHERE user_id = $1
                    ORDER BY created_at DESC
                    LIMIT 1
                )
                  AND created_at > NOW() - INTERVAL '24 hours'
                GROUP BY ip_address
                HAVING COUNT(DISTINCT user_id) > 3
            `;
            const multipleAccountsResult = await pool.query(multipleAccountsQuery, [userId]);

            if (multipleAccountsResult.rows.length > 0) {
                suspicious.isSuspicious = true;
                suspicious.reasons.push('Multiple accounts from same IP');
                suspicious.severity = 'high';

                await this.flagSuspiciousActivity(userId, 'multiple_accounts', 'Same IP used by multiple accounts');
            }

            // Check 3: Rapid profile changes
            const profileChangesQuery = `
                SELECT COUNT(*) as count
                FROM activity_log
                WHERE user_id = $1
                  AND activity_type = 'profile_update'
                  AND created_at > NOW() - INTERVAL '1 day'
            `;
            const profileChangesResult = await pool.query(profileChangesQuery, [userId]);
            const profileChanges = parseInt(profileChangesResult.rows[0].count);

            if (profileChanges > 10) {
                suspicious.isSuspicious = true;
                suspicious.reasons.push(`Excessive profile updates: ${profileChanges} in 24 hours`);
                suspicious.severity = 'medium';

                await this.flagSuspiciousActivity(userId, 'rapid_profile_changes', `${profileChanges} updates in 24 hours`);
            }

            // Check 4: Messages sent to many different users quickly
            const rapidMessagingQuery = `
                SELECT COUNT(DISTINCT target_user_id) as unique_recipients
                FROM activity_log
                WHERE user_id = $1
                  AND activity_type = 'message'
                  AND created_at > NOW() - INTERVAL '1 hour'
            `;
            const rapidMessagingResult = await pool.query(rapidMessagingQuery, [userId]);
            const uniqueRecipients = parseInt(rapidMessagingResult.rows[0].unique_recipients);

            if (uniqueRecipients > 20) {
                suspicious.isSuspicious = true;
                suspicious.reasons.push(`Mass messaging: ${uniqueRecipients} different users in 1 hour`);
                suspicious.severity = 'high';

                await this.flagSuspiciousActivity(userId, 'mass_messaging', `Messaged ${uniqueRecipients} users in 1 hour`);
            }

            // Check 5: Login from multiple IPs in short time
            const multipleIPsQuery = `
                SELECT COUNT(DISTINCT ip_address) as ip_count
                FROM activity_log
                WHERE user_id = $1
                  AND activity_type = 'login'
                  AND created_at > NOW() - INTERVAL '1 hour'
            `;
            const multipleIPsResult = await pool.query(multipleIPsQuery, [userId]);
            const ipCount = parseInt(multipleIPsResult.rows[0].ip_count);

            if (ipCount > 5) {
                suspicious.isSuspicious = true;
                suspicious.reasons.push(`Multiple IPs: ${ipCount} different IPs in 1 hour`);
                suspicious.severity = 'medium';

                await this.flagSuspiciousActivity(userId, 'multiple_ips', `${ipCount} IPs in 1 hour`);
            }

            return suspicious;

        } catch (error) {
            console.error('Error detecting suspicious activity:', error);
            return { isSuspicious: false, reasons: [], severity: 'low' };
        }
    }

    /**
     * Flag suspicious activity in database
     * @param {string} userId - User ID
     * @param {string} type - Type of suspicious activity
     * @param {string} reason - Reason description
     */
    async flagSuspiciousActivity(userId, type, reason) {
        try {
            const query = `
                UPDATE activity_log
                SET is_suspicious = true,
                    suspicious_reason = $1
                WHERE user_id = $2
                  AND created_at > NOW() - INTERVAL '1 hour'
                  AND is_suspicious = false
            `;

            await pool.query(query, [reason, userId]);

            // TODO: Notify admins (Phase 8)
            console.log(`⚠️ Suspicious activity detected for user ${userId}: ${type} - ${reason}`);

        } catch (error) {
            console.error('Error flagging suspicious activity:', error);
        }
    }

    /**
     * Get activity statistics for a user
     * @param {string} userId - User ID
     * @param {string} timeframe - Timeframe ('day', 'week', 'month')
     * @returns {Promise<Object>} Activity statistics
     */
    async getUserActivityStats(userId, timeframe = 'day') {
        try {
            const intervals = {
                'day': '24 hours',
                'week': '7 days',
                'month': '30 days'
            };

            const interval = intervals[timeframe] || '24 hours';

            const query = `
                SELECT
                    activity_type,
                    COUNT(*) as count
                FROM activity_log
                WHERE user_id = $1
                  AND created_at > NOW() - INTERVAL '${interval}'
                GROUP BY activity_type
                ORDER BY count DESC
            `;

            const result = await pool.query(query, [userId]);

            const stats = {};
            result.rows.forEach(row => {
                stats[row.activity_type] = parseInt(row.count);
            });

            return stats;

        } catch (error) {
            console.error('Error getting activity stats:', error);
            return {};
        }
    }

    /**
     * Get all suspicious users (admin)
     * @param {number} limit - Number of users to return
     * @returns {Promise<Array>} List of suspicious users
     */
    async getSuspiciousUsers(limit = 50) {
        try {
            const query = `
                SELECT
                    al.user_id,
                    u.phone_number,
                    p.first_name,
                    p.last_name,
                    COUNT(*) as suspicious_activity_count,
                    MAX(al.created_at) as last_suspicious_activity,
                    STRING_AGG(DISTINCT al.suspicious_reason, ', ') as reasons
                FROM activity_log al
                JOIN users u ON al.user_id = u.id
                LEFT JOIN profiles p ON u.id = p.user_id
                WHERE al.is_suspicious = true
                  AND al.created_at > NOW() - INTERVAL '7 days'
                GROUP BY al.user_id, u.phone_number, p.first_name, p.last_name
                HAVING COUNT(*) > 5
                ORDER BY suspicious_activity_count DESC, last_suspicious_activity DESC
                LIMIT $1
            `;

            const result = await pool.query(query, [limit]);

            return result.rows.map(row => ({
                userId: row.user_id,
                phoneNumber: row.phone_number,
                firstName: row.first_name,
                lastName: row.last_name,
                suspiciousActivityCount: parseInt(row.suspicious_activity_count),
                lastSuspiciousActivity: row.last_suspicious_activity,
                reasons: row.reasons
            }));

        } catch (error) {
            console.error('Error getting suspicious users:', error);
            return [];
        }
    }

    /**
     * Get activity timeline for a user (admin)
     * @param {string} userId - User ID
     * @param {number} limit - Number of activities to return
     * @returns {Promise<Array>} Activity timeline
     */
    async getUserActivityTimeline(userId, limit = 100) {
        try {
            const query = `
                SELECT
                    activity_type,
                    target_user_id,
                    ip_address,
                    is_suspicious,
                    suspicious_reason,
                    created_at
                FROM activity_log
                WHERE user_id = $1
                ORDER BY created_at DESC
                LIMIT $2
            `;

            const result = await pool.query(query, [userId, limit]);

            return result.rows;

        } catch (error) {
            console.error('Error getting activity timeline:', error);
            return [];
        }
    }

    /**
     * Clear old activity logs (cleanup job)
     * @param {number} daysToKeep - Number of days to keep
     */
    async cleanupOldLogs(daysToKeep = 90) {
        try {
            const query = `
                DELETE FROM activity_log
                WHERE created_at < NOW() - INTERVAL '${daysToKeep} days'
                  AND is_suspicious = false
                RETURNING COUNT(*) as deleted_count
            `;

            const result = await pool.query(query);
            const deletedCount = result.rows[0]?.deleted_count || 0;

            console.log(`🧹 Cleaned up ${deletedCount} old activity logs`);

            return deletedCount;

        } catch (error) {
            console.error('Error cleaning up logs:', error);
            return 0;
        }
    }
}

module.exports = new ActivityService();
