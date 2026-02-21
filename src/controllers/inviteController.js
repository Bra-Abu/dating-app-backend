// Invite Controller - Handles invite code related API endpoints
const inviteService = require('../services/inviteService');
const pool = require('../config/database');

class InviteController {
    /**
     * GET /api/invites/my-code
     * Get current user's invite code
     */
    async getMyInviteCode(req, res) {
        try {
            const userId = req.user.id;

            const inviteCode = await inviteService.getUserInviteCode(userId);

            res.json({
                success: true,
                data: {
                    code: inviteCode.code,
                    maxUses: inviteCode.max_uses,
                    timesUsed: inviteCode.times_used,
                    remainingUses: inviteCode.max_uses - inviteCode.times_used,
                    isActive: inviteCode.is_active,
                    createdAt: inviteCode.created_at
                }
            });
        } catch (error) {
            console.error('Error getting invite code:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve invite code'
            });
        }
    }

    /**
     * POST /api/invites/validate
     * Validate an invite code
     * Body: { code: string }
     */
    async validateInviteCode(req, res) {
        try {
            const { code } = req.body;

            if (!code) {
                return res.status(400).json({
                    success: false,
                    error: 'Invite code is required'
                });
            }

            const validation = await inviteService.validateInviteCode(code);

            if (!validation.valid) {
                return res.status(400).json({
                    success: false,
                    valid: false,
                    error: validation.reason
                });
            }

            res.json({
                success: true,
                valid: true,
                message: 'Invite code is valid',
                data: {
                    code: validation.inviteCode.code,
                    remainingUses: validation.inviteCode.max_uses - validation.inviteCode.times_used
                }
            });
        } catch (error) {
            console.error('Error validating invite code:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to validate invite code'
            });
        }
    }

    /**
     * GET /api/invites/stats
     * Get invite code usage statistics
     */
    async getInviteStats(req, res) {
        try {
            const userId = req.user.id;

            const stats = await inviteService.getInviteStats(userId);

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            console.error('Error getting invite stats:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve invite statistics'
            });
        }
    }

    /**
     * GET /api/invites/invited-users
     * Get list of users invited by current user
     */
    async getInvitedUsers(req, res) {
        try {
            const userId = req.user.id;

            const invitedUsers = await inviteService.getInvitedUsers(userId);

            res.json({
                success: true,
                data: invitedUsers,
                count: invitedUsers.length
            });
        } catch (error) {
            console.error('Error getting invited users:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve invited users'
            });
        }
    }

    /**
     * GET /api/invites/all-codes
     * Get all invite codes for current user (admin sees all their codes)
     */
    async getAllMyCodes(req, res) {
        try {
            const userId = req.user.id;

            const result = await pool.query(
                `SELECT ic.*, u.phone_number as used_by_phone, p.first_name, p.last_name
                 FROM invite_codes ic
                 LEFT JOIN users u ON u.invite_code_used = ic.code
                 LEFT JOIN profiles p ON p.user_id = u.id
                 WHERE ic.created_by = $1
                 ORDER BY ic.created_at DESC`,
                [userId]
            );

            const codes = result.rows.map(row => ({
                id: row.id,
                code: row.code,
                maxUses: row.max_uses,
                timesUsed: row.times_used,
                remainingUses: row.max_uses - row.times_used,
                isActive: row.is_active,
                createdAt: row.created_at,
            }));

            res.json({ success: true, data: codes });
        } catch (error) {
            console.error('Error getting all codes:', error);
            res.status(500).json({ success: false, error: 'Failed to retrieve invite codes' });
        }
    }

    /**
     * POST /api/invites/generate
     * Generate a new invite code.
     * Admins: always allowed, keeps existing codes active.
     * Regular users: only when current code is exhausted.
     */
    async generateNewInviteCode(req, res) {
        try {
            const userId = req.user.id;
            const isAdmin = req.user.account_type === 'admin' || req.user.account_type === 'super_admin';

            if (!isAdmin) {
                // Regular users: only generate when current code is exhausted
                const currentCode = await inviteService.getUserInviteCode(userId);
                if (currentCode.times_used < currentCode.max_uses) {
                    return res.status(400).json({
                        success: false,
                        error: 'Your current invite code still has remaining uses'
                    });
                }
                // Deactivate exhausted code and create new one
                await inviteService.deactivateInviteCode(userId, currentCode.code);
            }

            // Admins: just create a new code, leave existing ones active
            const newCode = await inviteService.createInviteCode(userId, 5);

            res.json({
                success: true,
                message: 'New invite code generated successfully',
                data: {
                    code: newCode.code,
                    maxUses: newCode.max_uses,
                    timesUsed: newCode.times_used,
                    remainingUses: newCode.max_uses - newCode.times_used,
                    isActive: newCode.is_active
                }
            });
        } catch (error) {
            console.error('Error generating invite code:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to generate new invite code'
            });
        }
    }

    /**
     * POST /api/invites/deactivate
     * Deactivate an invite code
     * Body: { code: string }
     */
    async deactivateInviteCode(req, res) {
        try {
            const userId = req.user.id;
            const { code } = req.body;

            if (!code) {
                return res.status(400).json({
                    success: false,
                    error: 'Invite code is required'
                });
            }

            const updatedCode = await inviteService.deactivateInviteCode(userId, code);

            res.json({
                success: true,
                message: 'Invite code deactivated successfully',
                data: updatedCode
            });
        } catch (error) {
            console.error('Error deactivating invite code:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to deactivate invite code'
            });
        }
    }
}

module.exports = new InviteController();
