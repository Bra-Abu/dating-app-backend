// Invite Service - Manages invite codes for the marriage platform
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/database');

class InviteService {
    /**
     * Generate a unique 8-character invite code
     * Format: XXXX-XXXX (uppercase alphanumeric)
     */
    generateInviteCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars like 0, O, 1, I
        let code = '';
        for (let i = 0; i < 8; i++) {
            if (i === 4) code += '-';
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    /**
     * Create an invite code for a user
     * @param {string} userId - User UUID
     * @param {number} maxUses - Maximum number of times the code can be used (default: 5)
     * @returns {Promise<Object>} Created invite code object
     */
    async createInviteCode(userId, maxUses = 5) {
        let code;
        let attempts = 0;
        const maxAttempts = 10;

        // Try to generate a unique code
        while (attempts < maxAttempts) {
            code = this.generateInviteCode();

            try {
                const query = `
                    INSERT INTO invite_codes (user_id, code, max_uses)
                    VALUES ($1, $2, $3)
                    RETURNING *
                `;
                const result = await pool.query(query, [userId, code, maxUses]);
                return result.rows[0];
            } catch (error) {
                if (error.code === '23505') { // Unique violation
                    attempts++;
                    continue;
                }
                throw error;
            }
        }

        throw new Error('Failed to generate unique invite code after multiple attempts');
    }

    /**
     * Get user's invite code (create if doesn't exist)
     * @param {string} userId - User UUID
     * @returns {Promise<Object>} Invite code object
     */
    async getUserInviteCode(userId) {
        // Check if user already has an active invite code
        const query = `
            SELECT * FROM invite_codes
            WHERE user_id = $1 AND is_active = true
            ORDER BY created_at DESC
            LIMIT 1
        `;
        const result = await pool.query(query, [userId]);

        if (result.rows.length > 0) {
            return result.rows[0];
        }

        // Create new invite code if none exists
        return await this.createInviteCode(userId);
    }

    /**
     * Validate an invite code
     * @param {string} code - Invite code to validate
     * @returns {Promise<Object>} Validation result
     */
    async validateInviteCode(code) {
        const query = `
            SELECT
                ic.*,
                u.phone_number as inviter_phone,
                u.status as inviter_status
            FROM invite_codes ic
            JOIN users u ON ic.user_id = u.id
            WHERE ic.code = $1
        `;
        const result = await pool.query(query, [code.toUpperCase()]);

        if (result.rows.length === 0) {
            return {
                valid: false,
                reason: 'Invalid invite code'
            };
        }

        const inviteCode = result.rows[0];

        // Check if code is active
        if (!inviteCode.is_active) {
            return {
                valid: false,
                reason: 'Invite code has been deactivated'
            };
        }

        // Check if code has expired
        if (inviteCode.expires_at && new Date(inviteCode.expires_at) < new Date()) {
            return {
                valid: false,
                reason: 'Invite code has expired'
            };
        }

        // Check if code has reached max uses
        if (inviteCode.times_used >= inviteCode.max_uses) {
            return {
                valid: false,
                reason: 'Invite code has reached maximum uses'
            };
        }

        // Check if inviter is in good standing
        if (inviteCode.inviter_status !== 'active') {
            return {
                valid: false,
                reason: 'Inviter account is not active'
            };
        }

        return {
            valid: true,
            inviteCode
        };
    }

    /**
     * Use an invite code (increment usage count)
     * @param {string} code - Invite code
     * @param {string} invitedUserId - UUID of user being invited
     * @returns {Promise<Object>} Updated invite code
     */
    async useInviteCode(code, invitedUserId) {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Validate the code first
            const validation = await this.validateInviteCode(code);
            if (!validation.valid) {
                throw new Error(validation.reason);
            }

            // Increment usage count
            const updateQuery = `
                UPDATE invite_codes
                SET times_used = times_used + 1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE code = $1
                RETURNING *
            `;
            const result = await client.query(updateQuery, [code.toUpperCase()]);

            // Update the invited user's record
            const userUpdateQuery = `
                UPDATE users
                SET invited_by = $1,
                    invite_code_used = $2,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $3
            `;
            await client.query(userUpdateQuery, [
                validation.inviteCode.user_id,
                code.toUpperCase(),
                invitedUserId
            ]);

            await client.query('COMMIT');
            return result.rows[0];
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Get invite code usage statistics
     * @param {string} userId - User UUID
     * @returns {Promise<Object>} Usage statistics
     */
    async getInviteStats(userId) {
        const query = `
            SELECT
                ic.code,
                ic.max_uses,
                ic.times_used,
                ic.is_active,
                ic.created_at,
                COUNT(u.id) as successful_registrations,
                COUNT(CASE WHEN u.status = 'active' THEN 1 END) as active_users,
                COUNT(CASE WHEN u.status = 'pending_approval' THEN 1 END) as pending_users
            FROM invite_codes ic
            LEFT JOIN users u ON u.invited_by = ic.user_id AND u.invite_code_used = ic.code
            WHERE ic.user_id = $1
            GROUP BY ic.id, ic.code, ic.max_uses, ic.times_used, ic.is_active, ic.created_at
            ORDER BY ic.created_at DESC
        `;
        const result = await pool.query(query, [userId]);
        return result.rows;
    }

    /**
     * Get list of users invited by a user
     * @param {string} userId - User UUID
     * @returns {Promise<Array>} List of invited users
     */
    async getInvitedUsers(userId) {
        const query = `
            SELECT
                u.id,
                u.phone_number,
                u.status,
                u.created_at,
                u.approved_at,
                p.first_name,
                p.last_name
            FROM users u
            LEFT JOIN profiles p ON u.id = p.user_id
            WHERE u.invited_by = $1
            ORDER BY u.created_at DESC
        `;
        const result = await pool.query(query, [userId]);
        return result.rows;
    }

    /**
     * Deactivate an invite code
     * @param {string} userId - User UUID
     * @param {string} code - Invite code to deactivate
     * @returns {Promise<Object>} Updated invite code
     */
    async deactivateInviteCode(userId, code) {
        const query = `
            UPDATE invite_codes
            SET is_active = false,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $1 AND code = $2
            RETURNING *
        `;
        const result = await pool.query(query, [userId, code.toUpperCase()]);

        if (result.rows.length === 0) {
            throw new Error('Invite code not found or does not belong to user');
        }

        return result.rows[0];
    }
}

module.exports = new InviteService();
