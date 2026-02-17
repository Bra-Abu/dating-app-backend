// Report Controller - Handle user reports and blocks
const pool = require('../config/database');

class ReportController {
    /**
     * POST /api/reports/create
     * Create a report against another user
     * Body: { reportedUserId, reportType, description, evidenceUrls }
     */
    async createReport(req, res) {
        try {
            const reporterId = req.user.id;
            const { reportedUserId, reportType, description, evidenceUrls } = req.body;

            // Validation
            if (!reportedUserId || !reportType || !description) {
                return res.status(400).json({
                    success: false,
                    error: 'Reported user ID, report type, and description are required'
                });
            }

            if (reporterId === reportedUserId) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot report yourself'
                });
            }

            // Validate report type
            const validTypes = ['fake_profile', 'harassment', 'scam', 'inappropriate_content', 'impersonation', 'spam', 'other'];
            if (!validTypes.includes(reportType)) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid report type. Must be one of: ${validTypes.join(', ')}`
                });
            }

            // Check if reported user exists
            const userCheck = await pool.query(
                'SELECT id FROM users WHERE id = $1',
                [reportedUserId]
            );

            if (userCheck.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Reported user not found'
                });
            }

            // Check if user has already reported this user for the same reason recently
            const duplicateCheck = await pool.query(
                `SELECT id FROM reports
                 WHERE reporter_id = $1 AND reported_user_id = $2
                   AND report_type = $3
                   AND created_at > NOW() - INTERVAL '24 hours'`,
                [reporterId, reportedUserId, reportType]
            );

            if (duplicateCheck.rows.length > 0) {
                return res.status(400).json({
                    success: false,
                    error: 'You have already reported this user for this reason in the last 24 hours'
                });
            }

            // Create report
            const insertQuery = `
                INSERT INTO reports (
                    reporter_id,
                    reported_user_id,
                    report_type,
                    description,
                    evidence_urls,
                    status
                ) VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
            `;

            const result = await pool.query(insertQuery, [
                reporterId,
                reportedUserId,
                reportType,
                description,
                evidenceUrls ? JSON.stringify(evidenceUrls) : null,
                'pending'
            ]);

            // TODO: Notify admins of new report (Phase 8)

            res.status(201).json({
                success: true,
                message: 'Report submitted successfully. Our team will review it shortly.',
                data: {
                    reportId: result.rows[0].id,
                    status: 'pending',
                    createdAt: result.rows[0].created_at
                }
            });

        } catch (error) {
            console.error('Error creating report:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to create report'
            });
        }
    }

    /**
     * GET /api/reports/my-reports
     * Get all reports created by current user
     */
    async getMyReports(req, res) {
        try {
            const reporterId = req.user.id;

            const query = `
                SELECT
                    r.*,
                    p.first_name as reported_first_name,
                    p.last_name as reported_last_name
                FROM reports r
                LEFT JOIN profiles p ON r.reported_user_id = p.user_id
                WHERE r.reporter_id = $1
                ORDER BY r.created_at DESC
            `;

            const result = await pool.query(query, [reporterId]);

            const reports = result.rows.map(row => ({
                reportId: row.id,
                reportedUser: {
                    userId: row.reported_user_id,
                    firstName: row.reported_first_name,
                    lastName: row.reported_last_name
                },
                reportType: row.report_type,
                description: row.description,
                status: row.status,
                actionTaken: row.action_taken,
                createdAt: row.created_at,
                reviewedAt: row.reviewed_at
            }));

            res.json({
                success: true,
                data: reports,
                count: reports.length
            });

        } catch (error) {
            console.error('Error getting my reports:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get reports'
            });
        }
    }

    // ========================================================================
    // BLOCK FUNCTIONALITY
    // ========================================================================

    /**
     * POST /api/blocks/block/:userId
     * Block a user
     */
    async blockUser(req, res) {
        try {
            const blockerId = req.user.id;
            const { userId: blockedId } = req.params;
            const { reason } = req.body;

            if (blockerId === blockedId) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot block yourself'
                });
            }

            // Check if already blocked
            const existingBlock = await pool.query(
                'SELECT id FROM blocks WHERE blocker_id = $1 AND blocked_id = $2',
                [blockerId, blockedId]
            );

            if (existingBlock.rows.length > 0) {
                return res.status(400).json({
                    success: false,
                    error: 'User is already blocked'
                });
            }

            // Create block
            const insertQuery = `
                INSERT INTO blocks (blocker_id, blocked_id, reason)
                VALUES ($1, $2, $3)
                RETURNING *
            `;

            await pool.query(insertQuery, [blockerId, blockedId, reason]);

            // If there's a match, update it to blocked status
            await pool.query(
                `UPDATE matches
                 SET status = 'blocked', updated_at = CURRENT_TIMESTAMP
                 WHERE ((user_id_1 = $1 AND user_id_2 = $2) OR (user_id_1 = $2 AND user_id_2 = $1))
                   AND status = 'active'`,
                [blockerId, blockedId]
            );

            res.json({
                success: true,
                message: 'User blocked successfully'
            });

        } catch (error) {
            console.error('Error blocking user:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to block user'
            });
        }
    }

    /**
     * DELETE /api/blocks/unblock/:userId
     * Unblock a user
     */
    async unblockUser(req, res) {
        try {
            const blockerId = req.user.id;
            const { userId: blockedId } = req.params;

            const deleteQuery = `
                DELETE FROM blocks
                WHERE blocker_id = $1 AND blocked_id = $2
                RETURNING *
            `;

            const result = await pool.query(deleteQuery, [blockerId, blockedId]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Block not found'
                });
            }

            res.json({
                success: true,
                message: 'User unblocked successfully'
            });

        } catch (error) {
            console.error('Error unblocking user:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to unblock user'
            });
        }
    }

    /**
     * GET /api/blocks/list
     * Get list of blocked users
     */
    async getBlockedUsers(req, res) {
        try {
            const blockerId = req.user.id;

            const query = `
                SELECT
                    b.*,
                    p.first_name,
                    p.last_name,
                    p.photo_urls
                FROM blocks b
                LEFT JOIN profiles p ON b.blocked_id = p.user_id
                WHERE b.blocker_id = $1
                ORDER BY b.created_at DESC
            `;

            const result = await pool.query(query, [blockerId]);

            const blockedUsers = result.rows.map(row => ({
                userId: row.blocked_id,
                firstName: row.first_name,
                lastName: row.last_name,
                photoUrls: row.photo_urls,
                reason: row.reason,
                blockedAt: row.created_at
            }));

            res.json({
                success: true,
                data: blockedUsers,
                count: blockedUsers.length
            });

        } catch (error) {
            console.error('Error getting blocked users:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get blocked users'
            });
        }
    }

    /**
     * GET /api/blocks/check/:userId
     * Check if a user is blocked
     */
    async checkIfBlocked(req, res) {
        try {
            const userId = req.user.id;
            const { userId: targetUserId } = req.params;

            const query = `
                SELECT COUNT(*) as count FROM blocks
                WHERE (blocker_id = $1 AND blocked_id = $2)
                   OR (blocker_id = $2 AND blocked_id = $1)
            `;

            const result = await pool.query(query, [userId, targetUserId]);
            const isBlocked = parseInt(result.rows[0].count) > 0;

            res.json({
                success: true,
                data: {
                    isBlocked,
                    userId: targetUserId
                }
            });

        } catch (error) {
            console.error('Error checking block status:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to check block status'
            });
        }
    }

    // ========================================================================
    // ADMIN ENDPOINTS
    // ========================================================================

    /**
     * GET /api/admin/reports
     * Get all reports (admin only)
     * Query params: status, reportType, page, limit
     */
    async getAllReports(req, res) {
        try {
            const { status, reportType, page = 1, limit = 50 } = req.query;
            const offset = (page - 1) * limit;

            let whereConditions = [];
            let values = [];
            let paramCount = 1;

            if (status) {
                whereConditions.push(`r.status = $${paramCount}`);
                values.push(status);
                paramCount++;
            }

            if (reportType) {
                whereConditions.push(`r.report_type = $${paramCount}`);
                values.push(reportType);
                paramCount++;
            }

            const whereClause = whereConditions.length > 0
                ? `WHERE ${whereConditions.join(' AND ')}`
                : '';

            const query = `
                SELECT
                    r.*,
                    reporter.phone_number as reporter_phone,
                    reporter_profile.first_name as reporter_first_name,
                    reporter_profile.last_name as reporter_last_name,
                    reported.phone_number as reported_phone,
                    reported_profile.first_name as reported_first_name,
                    reported_profile.last_name as reported_last_name,
                    reviewer.phone_number as reviewer_phone
                FROM reports r
                JOIN users reporter ON r.reporter_id = reporter.id
                JOIN users reported ON r.reported_user_id = reported.id
                LEFT JOIN profiles reporter_profile ON r.reporter_id = reporter_profile.user_id
                LEFT JOIN profiles reported_profile ON r.reported_user_id = reported_profile.user_id
                LEFT JOIN users reviewer ON r.reviewed_by = reviewer.id
                ${whereClause}
                ORDER BY
                    CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END,
                    r.created_at DESC
                LIMIT $${paramCount} OFFSET $${paramCount + 1}
            `;

            values.push(parseInt(limit), parseInt(offset));

            const result = await pool.query(query, values);

            // Get total count
            const countQuery = `SELECT COUNT(*) FROM reports r ${whereClause}`;
            const countResult = await pool.query(countQuery, values.slice(0, -2));
            const totalCount = parseInt(countResult.rows[0].count);

            res.json({
                success: true,
                data: result.rows,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: totalCount,
                    pages: Math.ceil(totalCount / limit)
                }
            });

        } catch (error) {
            console.error('Error getting all reports:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get reports'
            });
        }
    }

    /**
     * POST /api/admin/reports/:reportId/resolve
     * Resolve a report (admin only)
     * Body: { actionTaken, notes }
     */
    async resolveReport(req, res) {
        try {
            const { reportId } = req.params;
            const { actionTaken, notes } = req.body;
            const adminId = req.admin.id;

            if (!actionTaken) {
                return res.status(400).json({
                    success: false,
                    error: 'Action taken is required'
                });
            }

            // Update report
            const updateQuery = `
                UPDATE reports
                SET status = 'resolved',
                    reviewed_by = $1,
                    reviewed_at = CURRENT_TIMESTAMP,
                    action_taken = $2,
                    admin_notes = $3,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $4
                RETURNING *
            `;

            const result = await pool.query(updateQuery, [
                adminId,
                actionTaken,
                notes,
                reportId
            ]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Report not found'
                });
            }

            // Log admin action
            const { logAdminAction } = require('../middleware/adminMiddleware');
            await logAdminAction(
                adminId,
                'resolve_report',
                result.rows[0].reported_user_id,
                actionTaken,
                {
                    entityType: 'report',
                    entityId: reportId,
                    reportType: result.rows[0].report_type
                },
                req.admin.ipAddress,
                req.admin.userAgent
            );

            res.json({
                success: true,
                message: 'Report resolved successfully'
            });

        } catch (error) {
            console.error('Error resolving report:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to resolve report'
            });
        }
    }

    /**
     * POST /api/admin/reports/:reportId/dismiss
     * Dismiss a report (admin only)
     * Body: { reason }
     */
    async dismissReport(req, res) {
        try {
            const { reportId } = req.params;
            const { reason } = req.body;
            const adminId = req.admin.id;

            const updateQuery = `
                UPDATE reports
                SET status = 'dismissed',
                    reviewed_by = $1,
                    reviewed_at = CURRENT_TIMESTAMP,
                    action_taken = 'Dismissed',
                    admin_notes = $2,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $3
                RETURNING *
            `;

            const result = await pool.query(updateQuery, [adminId, reason, reportId]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Report not found'
                });
            }

            res.json({
                success: true,
                message: 'Report dismissed'
            });

        } catch (error) {
            console.error('Error dismissing report:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to dismiss report'
            });
        }
    }
}

module.exports = new ReportController();
