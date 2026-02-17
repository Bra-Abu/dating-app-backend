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
     * POST /api/invites/generate
     * Generate a new invite code for current user
     * (Admin only or when user's current code is exhausted)
     */
    async generateNewInviteCode(req, res) {
        try {
            const userId = req.user.id;
            const { maxUses } = req.body;

            // Check if user is admin or has good reason for new code
            const currentCode = await inviteService.getUserInviteCode(userId);

            // Only generate new code if current is exhausted or user is admin
            if (currentCode.times_used < currentCode.max_uses && req.user.account_type !== 'admin') {
                return res.status(400).json({
                    success: false,
                    error: 'Your current invite code still has remaining uses'
                });
            }

            // Deactivate old code
            if (currentCode.is_active) {
                await inviteService.deactivateInviteCode(userId, currentCode.code);
            }

            // Create new code
            const newCode = await inviteService.createInviteCode(userId, maxUses || 5);

            res.json({
                success: true,
                message: 'New invite code generated successfully',
                data: {
                    code: newCode.code,
                    maxUses: newCode.max_uses,
                    timesUsed: newCode.times_used,
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
