// Admin Controller - Handles admin dashboard and moderation
const pool = require('../config/database');
const { logAdminAction } = require('../middleware/adminMiddleware');

class AdminController {
    /**
     * GET /api/admin/users/pending
     * Get all users pending approval
     */
    async getPendingUsers(req, res) {
        try {
            const query = `
                SELECT
                    u.id,
                    u.firebase_uid,
                    u.phone_number,
                    u.email,
                    u.status,
                    u.invited_by,
                    u.invite_code_used,
                    u.created_at,
                    p.first_name,
                    p.last_name,
                    p.gender,
                    p.date_of_birth,
                    p.city,
                    p.religion,
                    inviter.phone_number as inviter_phone
                FROM users u
                LEFT JOIN profiles p ON u.id = p.user_id
                LEFT JOIN users inviter ON u.invited_by = inviter.id
                WHERE u.status = 'pending_approval'
                ORDER BY u.created_at ASC
            `;

            const result = await pool.query(query);

            res.json({
                success: true,
                data: result.rows,
                count: result.rows.length
            });
        } catch (error) {
            console.error('Error getting pending users:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve pending users'
            });
        }
    }

    /**
     * POST /api/admin/users/:userId/approve
     * Approve a pending user
     * Body: { reason?: string }
     */
    async approveUser(req, res) {
        try {
            const { userId } = req.params;
            const { reason } = req.body;
            const adminId = req.admin.id;

            // Get user details before approval
            const userQuery = 'SELECT * FROM users WHERE id = $1';
            const userResult = await pool.query(userQuery, [userId]);

            if (userResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            const user = userResult.rows[0];

            if (user.status !== 'pending_approval') {
                return res.status(400).json({
                    success: false,
                    error: `User is not pending approval. Current status: ${user.status}`
                });
            }

            // Approve the user
            const updateQuery = `
                UPDATE users
                SET status = 'active',
                    approved_by = $1,
                    approved_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
                RETURNING *
            `;

            const result = await pool.query(updateQuery, [adminId, userId]);
            const approvedUser = result.rows[0];

            // Log admin action
            await logAdminAction(
                adminId,
                'approve_user',
                userId,
                reason || 'User approved',
                {
                    entityType: 'user',
                    entityId: userId,
                    previousStatus: user.status,
                    newStatus: 'active'
                },
                req.admin.ipAddress,
                req.admin.userAgent
            );

            // TODO: Send notification to user (Phase 8)

            res.json({
                success: true,
                message: 'User approved successfully',
                data: {
                    userId: approvedUser.id,
                    status: approvedUser.status,
                    approvedAt: approvedUser.approved_at
                }
            });
        } catch (error) {
            console.error('Error approving user:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to approve user'
            });
        }
    }

    /**
     * POST /api/admin/users/:userId/reject
     * Reject a pending user
     * Body: { reason: string }
     */
    async rejectUser(req, res) {
        try {
            const { userId } = req.params;
            const { reason } = req.body;
            const adminId = req.admin.id;

            if (!reason) {
                return res.status(400).json({
                    success: false,
                    error: 'Reason for rejection is required'
                });
            }

            // Get user details
            const userQuery = 'SELECT * FROM users WHERE id = $1';
            const userResult = await pool.query(userQuery, [userId]);

            if (userResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            const user = userResult.rows[0];

            // Update user status to deleted (soft delete)
            const updateQuery = `
                UPDATE users
                SET status = 'deleted',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
                RETURNING *
            `;

            await pool.query(updateQuery, [userId]);

            // Log admin action
            await logAdminAction(
                adminId,
                'reject_user',
                userId,
                reason,
                {
                    entityType: 'user',
                    entityId: userId,
                    previousStatus: user.status,
                    newStatus: 'deleted'
                },
                req.admin.ipAddress,
                req.admin.userAgent
            );

            // TODO: Send notification to user (Phase 8)

            res.json({
                success: true,
                message: 'User rejected successfully'
            });
        } catch (error) {
            console.error('Error rejecting user:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to reject user'
            });
        }
    }

    /**
     * POST /api/admin/users/:userId/suspend
     * Suspend a user account
     * Body: { reason: string, duration?: number } // duration in days
     */
    async suspendUser(req, res) {
        try {
            const { userId } = req.params;
            const { reason, duration } = req.body;
            const adminId = req.admin.id;

            if (!reason) {
                return res.status(400).json({
                    success: false,
                    error: 'Reason for suspension is required'
                });
            }

            // Get user details
            const userQuery = 'SELECT * FROM users WHERE id = $1';
            const userResult = await pool.query(userQuery, [userId]);

            if (userResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            const user = userResult.rows[0];

            // Prevent suspending admins (unless by super admin)
            if ((user.account_type === 'admin' || user.account_type === 'super_admin')
                && req.admin.account_type !== 'super_admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Only super admins can suspend admin accounts'
                });
            }

            // Suspend the user
            const updateQuery = `
                UPDATE users
                SET status = 'suspended',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
                RETURNING *
            `;

            await pool.query(updateQuery, [userId]);

            // Log admin action
            await logAdminAction(
                adminId,
                'suspend_user',
                userId,
                reason,
                {
                    entityType: 'user',
                    entityId: userId,
                    previousStatus: user.status,
                    newStatus: 'suspended',
                    duration: duration || 'indefinite'
                },
                req.admin.ipAddress,
                req.admin.userAgent
            );

            // TODO: Send notification to user (Phase 8)

            res.json({
                success: true,
                message: 'User suspended successfully',
                data: {
                    userId,
                    status: 'suspended',
                    reason,
                    duration: duration || 'indefinite'
                }
            });
        } catch (error) {
            console.error('Error suspending user:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to suspend user'
            });
        }
    }

    /**
     * POST /api/admin/users/:userId/unsuspend
     * Unsuspend a suspended user
     * Body: { reason?: string }
     */
    async unsuspendUser(req, res) {
        try {
            const { userId } = req.params;
            const { reason } = req.body;
            const adminId = req.admin.id;

            // Get user details
            const userQuery = 'SELECT * FROM users WHERE id = $1';
            const userResult = await pool.query(userQuery, [userId]);

            if (userResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            const user = userResult.rows[0];

            if (user.status !== 'suspended') {
                return res.status(400).json({
                    success: false,
                    error: `User is not suspended. Current status: ${user.status}`
                });
            }

            // Reactivate the user
            const updateQuery = `
                UPDATE users
                SET status = 'active',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
                RETURNING *
            `;

            await pool.query(updateQuery, [userId]);

            // Log admin action
            await logAdminAction(
                adminId,
                'unsuspend_user',
                userId,
                reason || 'User unsuspended',
                {
                    entityType: 'user',
                    entityId: userId,
                    previousStatus: 'suspended',
                    newStatus: 'active'
                },
                req.admin.ipAddress,
                req.admin.userAgent
            );

            // TODO: Send notification to user (Phase 8)

            res.json({
                success: true,
                message: 'User unsuspended successfully',
                data: {
                    userId,
                    status: 'active'
                }
            });
        } catch (error) {
            console.error('Error unsuspending user:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to unsuspend user'
            });
        }
    }

    /**
     * GET /api/admin/users
     * Get all users with filters
     * Query params: status, account_type, page, limit
     */
    async getAllUsers(req, res) {
        try {
            const {
                status,
                account_type,
                page = 1,
                limit = 50
            } = req.query;

            const offset = (page - 1) * limit;

            let whereConditions = [];
            let values = [];
            let paramCount = 1;

            if (status) {
                whereConditions.push(`u.status = $${paramCount}`);
                values.push(status);
                paramCount++;
            }

            if (account_type) {
                whereConditions.push(`u.account_type = $${paramCount}`);
                values.push(account_type);
                paramCount++;
            }

            const whereClause = whereConditions.length > 0
                ? `WHERE ${whereConditions.join(' AND ')}`
                : '';

            const query = `
                SELECT
                    u.id,
                    u.phone_number,
                    u.email,
                    u.status,
                    u.account_type,
                    u.created_at,
                    u.approved_at,
                    u.last_login_at,
                    p.first_name,
                    p.last_name,
                    p.gender,
                    p.city,
                    p.moderation_status,
                    approver.phone_number as approved_by_phone
                FROM users u
                LEFT JOIN profiles p ON u.id = p.user_id
                LEFT JOIN users approver ON u.approved_by = approver.id
                ${whereClause}
                ORDER BY u.created_at DESC
                LIMIT $${paramCount} OFFSET $${paramCount + 1}
            `;

            values.push(parseInt(limit), parseInt(offset));

            const result = await pool.query(query, values);

            // Get total count
            const countQuery = `
                SELECT COUNT(*) FROM users u
                ${whereClause}
            `;
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
            console.error('Error getting users:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve users'
            });
        }
    }

    /**
     * GET /api/admin/users/:userId
     * Get detailed user information
     */
    async getUserDetails(req, res) {
        try {
            const { userId } = req.params;

            const query = `
                SELECT
                    u.*,
                    p.*,
                    inviter.phone_number as inviter_phone,
                    approver.phone_number as approver_phone,
                    (SELECT COUNT(*) FROM matches WHERE user_id_1 = u.id OR user_id_2 = u.id) as total_matches,
                    (SELECT COUNT(*) FROM messages WHERE sender_id = u.id) as messages_sent,
                    (SELECT COUNT(*) FROM reports WHERE reported_user_id = u.id) as reports_against,
                    (SELECT COUNT(*) FROM reports WHERE reporter_id = u.id) as reports_made
                FROM users u
                LEFT JOIN profiles p ON u.id = p.user_id
                LEFT JOIN users inviter ON u.invited_by = inviter.id
                LEFT JOIN users approver ON u.approved_by = approver.id
                WHERE u.id = $1
            `;

            const result = await pool.query(query, [userId]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            res.json({
                success: true,
                data: result.rows[0]
            });
        } catch (error) {
            console.error('Error getting user details:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve user details'
            });
        }
    }

    /**
     * GET /api/admin/profiles/pending
     * Get profiles pending moderation
     */
    async getPendingProfiles(req, res) {
        try {
            const query = `
                SELECT
                    p.*,
                    u.phone_number,
                    u.created_at as user_created_at
                FROM profiles p
                JOIN users u ON p.user_id = u.id
                WHERE p.moderation_status = 'pending'
                ORDER BY p.created_at ASC
            `;

            const result = await pool.query(query);

            res.json({
                success: true,
                data: result.rows,
                count: result.rows.length
            });
        } catch (error) {
            console.error('Error getting pending profiles:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get pending profiles'
            });
        }
    }

    /**
     * POST /api/admin/profiles/:profileId/approve
     * Approve a profile
     */
    async approveProfile(req, res) {
        try {
            const { profileId } = req.params;
            const { notes } = req.body;
            const adminId = req.admin.id;

            const updateQuery = `
                UPDATE profiles
                SET moderation_status = 'approved',
                    moderated_by = $1,
                    moderated_at = CURRENT_TIMESTAMP,
                    moderation_notes = $2
                WHERE id = $3
                RETURNING *
            `;

            const result = await pool.query(updateQuery, [adminId, notes, profileId]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Profile not found'
                });
            }

            // Log admin action
            await logAdminAction(
                adminId,
                'approve_profile',
                result.rows[0].user_id,
                notes || 'Profile approved',
                { entityType: 'profile', entityId: profileId },
                req.admin.ipAddress,
                req.admin.userAgent
            );

            res.json({
                success: true,
                message: 'Profile approved successfully'
            });
        } catch (error) {
            console.error('Error approving profile:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to approve profile'
            });
        }
    }

    /**
     * POST /api/admin/profiles/:profileId/reject
     * Reject a profile
     */
    async rejectProfile(req, res) {
        try {
            const { profileId } = req.params;
            const { reason } = req.body;
            const adminId = req.admin.id;

            if (!reason) {
                return res.status(400).json({
                    success: false,
                    error: 'Rejection reason is required'
                });
            }

            const updateQuery = `
                UPDATE profiles
                SET moderation_status = 'rejected',
                    moderated_by = $1,
                    moderated_at = CURRENT_TIMESTAMP,
                    moderation_notes = $2
                WHERE id = $3
                RETURNING *
            `;

            const result = await pool.query(updateQuery, [adminId, reason, profileId]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Profile not found'
                });
            }

            // Log admin action
            await logAdminAction(
                adminId,
                'reject_profile',
                result.rows[0].user_id,
                reason,
                { entityType: 'profile', entityId: profileId },
                req.admin.ipAddress,
                req.admin.userAgent
            );

            res.json({
                success: true,
                message: 'Profile rejected'
            });
        } catch (error) {
            console.error('Error rejecting profile:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to reject profile'
            });
        }
    }

    /**
     * GET /api/admin/stats/overview
     * Get platform statistics
     */
    async getOverviewStats(req, res) {
        try {
            const statsQuery = `
                SELECT
                    (SELECT COUNT(*) FROM users) as total_users,
                    (SELECT COUNT(*) FROM users WHERE status = 'active') as active_users,
                    (SELECT COUNT(*) FROM users WHERE status = 'pending_approval') as pending_users,
                    (SELECT COUNT(*) FROM profiles WHERE is_complete = true) as complete_profiles,
                    (SELECT COUNT(*) FROM matches WHERE is_mutual_match = true) as total_matches,
                    (SELECT COUNT(*) FROM messages) as total_messages,
                    (SELECT COUNT(*) FROM verifications WHERE status = 'approved') as verified_users,
                    (SELECT COUNT(*) FROM reports WHERE status = 'pending') as pending_reports
            `;

            const result = await pool.query(statsQuery);
            const stats = result.rows[0];

            // Match rate
            const matchRateQuery = `
                SELECT
                    COUNT(DISTINCT user_id_1) + COUNT(DISTINCT user_id_2) as users_with_likes,
                    COUNT(*) FILTER (WHERE is_mutual_match = true) as mutual_matches
                FROM matches
            `;
            const matchRateResult = await pool.query(matchRateQuery);
            const matchRate = matchRateResult.rows[0];

            res.json({
                success: true,
                data: {
                    users: {
                        total: parseInt(stats.total_users),
                        active: parseInt(stats.active_users),
                        pending: parseInt(stats.pending_users)
                    },
                    profiles: {
                        complete: parseInt(stats.complete_profiles)
                    },
                    matching: {
                        totalMatches: parseInt(stats.total_matches),
                        matchRate: matchRate.users_with_likes > 0
                            ? Math.round((matchRate.mutual_matches / matchRate.users_with_likes) * 100)
                            : 0
                    },
                    messages: {
                        total: parseInt(stats.total_messages)
                    },
                    verification: {
                        verified: parseInt(stats.verified_users)
                    },
                    reports: {
                        pending: parseInt(stats.pending_reports)
                    }
                }
            });
        } catch (error) {
            console.error('Error getting overview stats:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get statistics'
            });
        }
    }

    /**
     * GET /api/admin/activity/suspicious
     * Get suspicious activity
     */
    async getSuspiciousActivity(req, res) {
        try {
            const activityService = require('../services/activityService');
            const suspiciousUsers = await activityService.getSuspiciousUsers(50);

            res.json({
                success: true,
                data: suspiciousUsers,
                count: suspiciousUsers.length
            });
        } catch (error) {
            console.error('Error getting suspicious activity:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get suspicious activity'
            });
        }
    }

    /**
     * GET /api/admin/actions
     * Get admin action logs
     * Query params: admin_id, action_type, page, limit
     */
    async getAdminActions(req, res) {
        try {
            const {
                admin_id,
                action_type,
                page = 1,
                limit = 50
            } = req.query;

            const offset = (page - 1) * limit;

            let whereConditions = [];
            let values = [];
            let paramCount = 1;

            if (admin_id) {
                whereConditions.push(`aa.admin_id = $${paramCount}`);
                values.push(admin_id);
                paramCount++;
            }

            if (action_type) {
                whereConditions.push(`aa.action_type = $${paramCount}`);
                values.push(action_type);
                paramCount++;
            }

            const whereClause = whereConditions.length > 0
                ? `WHERE ${whereConditions.join(' AND ')}`
                : '';

            const query = `
                SELECT
                    aa.*,
                    admin.phone_number as admin_phone,
                    target.phone_number as target_phone
                FROM admin_actions aa
                LEFT JOIN users admin ON aa.admin_id = admin.id
                LEFT JOIN users target ON aa.target_user_id = target.id
                ${whereClause}
                ORDER BY aa.created_at DESC
                LIMIT $${paramCount} OFFSET $${paramCount + 1}
            `;

            values.push(parseInt(limit), parseInt(offset));

            const result = await pool.query(query, values);

            // Get total count
            const countQuery = `
                SELECT COUNT(*) FROM admin_actions aa
                ${whereClause}
            `;
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
            console.error('Error getting admin actions:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve admin actions'
            });
        }
    }
}

module.exports = new AdminController();
