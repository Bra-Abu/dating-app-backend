// Auth Controller - Handles authentication logic
const admin = require('../config/firebase');
const pool = require('../config/database');
const inviteService = require('../services/inviteService');

class AuthController {
    /**
     * POST /api/auth/verify
     * Verify phone number and Firebase token (for login)
     */
    async verify(req, res) {
        try {
            const { idToken } = req.body;

            if (!idToken) {
                return res.status(400).json({
                    success: false,
                    error: 'ID token is required'
                });
            }

            // Verify the Firebase ID token
            const decodedToken = await admin.auth().verifyIdToken(idToken);
            const { uid, phone_number } = decodedToken;

            // Check if user exists in database
            const result = await pool.query(
                `SELECT u.*, p.first_name, p.last_name, p.is_complete
                 FROM users u
                 LEFT JOIN profiles p ON u.id = p.user_id
                 WHERE u.firebase_uid = $1`,
                [uid]
            );

            let user;
            let isNewUser = false;

            if (result.rows.length === 0) {
                // New user - return message that they need to register with invite code
                return res.status(404).json({
                    success: false,
                    isNewUser: true,
                    error: 'User not found. Please register with an invite code.',
                    requiresRegistration: true
                });
            } else {
                // Existing user - return their info
                user = result.rows[0];

                // Update last login time
                await pool.query(
                    'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
                    [user.id]
                );

                console.log('✅ User logged in:', user.id);
            }

            // Return user data
            res.json({
                success: true,
                message: 'Authentication successful',
                data: {
                    userId: user.id,
                    phoneNumber: user.phone_number,
                    status: user.status,
                    accountType: user.account_type,
                    isNewUser,
                    hasProfile: user.is_complete || false,
                    profileName: user.first_name ? `${user.first_name} ${user.last_name}` : null
                }
            });

        } catch (error) {
            console.error('Verification error:', error);
            res.status(401).json({
                success: false,
                error: 'Authentication failed',
                details: error.message
            });
        }
    }

    /**
     * POST /api/auth/register
     * Register a new user with invite code
     * Body: { idToken: string, inviteCode: string }
     */
    async register(req, res) {
        try {
            const { idToken, inviteCode } = req.body;

            if (!idToken || !inviteCode) {
                return res.status(400).json({
                    success: false,
                    error: 'ID token and invite code are required'
                });
            }

            // Verify the Firebase ID token
            const decodedToken = await admin.auth().verifyIdToken(idToken);
            const { uid, phone_number } = decodedToken;

            // Check if user already exists
            const existingUser = await pool.query(
                'SELECT * FROM users WHERE firebase_uid = $1 OR phone_number = $2',
                [uid, phone_number]
            );

            if (existingUser.rows.length > 0) {
                return res.status(400).json({
                    success: false,
                    error: 'User already exists. Please login instead.'
                });
            }

            // Validate invite code
            const validation = await inviteService.validateInviteCode(inviteCode);

            if (!validation.valid) {
                return res.status(400).json({
                    success: false,
                    error: validation.reason
                });
            }

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                // Create new user with pending_approval status
                const insertQuery = `
                    INSERT INTO users (
                        firebase_uid,
                        phone_number,
                        status,
                        account_type,
                        phone_verified
                    ) VALUES ($1, $2, $3, $4, $5)
                    RETURNING *
                `;

                const newUserResult = await client.query(insertQuery, [
                    uid,
                    phone_number,
                    'active', // Auto-approve on registration - profile needs separate approval
                    'user',
                    true // Phone is verified through Firebase
                ]);

                const newUser = newUserResult.rows[0];

                // Use the invite code (updates invite_codes table and links user)
                await inviteService.useInviteCode(inviteCode, newUser.id);

                await client.query('COMMIT');

                console.log('✅ New user registered:', newUser.id);

                // Generate invite code for the new user (after commit)
                await inviteService.createInviteCode(newUser.id, 5);

                res.status(201).json({
                    success: true,
                    message: 'Registration successful. Your account is pending admin approval.',
                    data: {
                        userId: newUser.id,
                        phoneNumber: newUser.phone_number,
                        status: newUser.status,
                        requiresApproval: true
                    }
                });

            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }

        } catch (error) {
            console.error('Registration error:', error);
            res.status(500).json({
                success: false,
                error: 'Registration failed',
                details: error.message
            });
        }
    }

    /**
     * POST /api/auth/validate-invite
     * Validate an invite code (public endpoint for registration flow)
     * Body: { code: string }
     */
    async validateInvite(req, res) {
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
            console.error('Invite validation error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to validate invite code'
            });
        }
    }

    /**
     * GET /api/auth/me
     * Get current authenticated user info
     */
    async getCurrentUser(req, res) {
        try {
            // User is already attached to req by verifyToken middleware
            const userId = req.user.id;

            const result = await pool.query(
                `SELECT
                    u.id,
                    u.firebase_uid,
                    u.phone_number,
                    u.email,
                    u.status,
                    u.account_type,
                    u.phone_verified,
                    u.email_verified,
                    u.created_at,
                    u.last_login_at,
                    p.first_name,
                    p.last_name,
                    p.gender,
                    p.date_of_birth,
                    p.city,
                    p.is_complete,
                    p.moderation_status,
                    p.photo_urls
                FROM users u
                LEFT JOIN profiles p ON u.id = p.user_id
                WHERE u.id = $1`,
                [userId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            const user = result.rows[0];

            res.json({
                success: true,
                data: {
                    user: {
                        id: user.id,
                        phoneNumber: user.phone_number,
                        email: user.email,
                        status: user.status,
                        accountType: user.account_type,
                        phoneVerified: user.phone_verified,
                        emailVerified: user.email_verified,
                        createdAt: user.created_at,
                        lastLoginAt: user.last_login_at
                    },
                    profile: user.is_complete ? {
                        firstName: user.first_name,
                        lastName: user.last_name,
                        gender: user.gender,
                        dateOfBirth: user.date_of_birth,
                        city: user.city,
                        isComplete: user.is_complete,
                        moderationStatus: user.moderation_status,
                        photoUrls: user.photo_urls
                    } : null
                }
            });

        } catch (error) {
            console.error('Get current user error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get user info'
            });
        }
    }
}

module.exports = new AuthController();
