// Verification Controller - Handle photo and ID verification
const pool = require('../config/database');
const path = require('path');

class VerificationController {
    /**
     * POST /api/verifications/photo
     * Upload selfie for photo verification
     */
    async uploadPhotoVerification(req, res) {
        try {
            const userId = req.user.id;

            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: 'No file uploaded. Please upload a selfie.'
                });
            }

            // Get file path
            const filePath = `/uploads/selfies/${req.file.filename}`;

            // Check if user already has a pending or approved photo verification
            const existingQuery = `
                SELECT * FROM verifications
                WHERE user_id = $1 AND verification_type = 'photo'
                    AND status IN ('pending', 'approved')
                ORDER BY created_at DESC
                LIMIT 1
            `;
            const existingResult = await pool.query(existingQuery, [userId]);

            if (existingResult.rows.length > 0) {
                const existing = existingResult.rows[0];
                if (existing.status === 'approved') {
                    return res.status(400).json({
                        success: false,
                        error: 'You already have an approved photo verification.'
                    });
                }
                if (existing.status === 'pending') {
                    return res.status(400).json({
                        success: false,
                        error: 'You already have a pending photo verification. Please wait for admin review.'
                    });
                }
            }

            // Create verification record
            const insertQuery = `
                INSERT INTO verifications (
                    user_id,
                    verification_type,
                    selfie_url,
                    status
                ) VALUES ($1, $2, $3, $4)
                RETURNING *
            `;
            const result = await pool.query(insertQuery, [
                userId,
                'photo',
                filePath,
                'pending'
            ]);

            res.status(201).json({
                success: true,
                message: 'Photo verification submitted successfully. Please wait for admin review.',
                data: {
                    verificationId: result.rows[0].id,
                    status: 'pending',
                    submittedAt: result.rows[0].created_at
                }
            });

        } catch (error) {
            console.error('Error uploading photo verification:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to upload photo verification',
                details: error.message
            });
        }
    }

    /**
     * POST /api/verifications/id
     * Upload ID document for verification
     */
    async uploadIdVerification(req, res) {
        try {
            const userId = req.user.id;

            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: 'No file uploaded. Please upload an ID document.'
                });
            }

            // Get file path
            const filePath = `/uploads/id-documents/${req.file.filename}`;

            // Check if user already has a pending or approved ID verification
            const existingQuery = `
                SELECT * FROM verifications
                WHERE user_id = $1 AND verification_type = 'id'
                    AND status IN ('pending', 'approved')
                ORDER BY created_at DESC
                LIMIT 1
            `;
            const existingResult = await pool.query(existingQuery, [userId]);

            if (existingResult.rows.length > 0) {
                const existing = existingResult.rows[0];
                if (existing.status === 'approved') {
                    return res.status(400).json({
                        success: false,
                        error: 'You already have an approved ID verification.'
                    });
                }
                if (existing.status === 'pending') {
                    return res.status(400).json({
                        success: false,
                        error: 'You already have a pending ID verification. Please wait for admin review.'
                    });
                }
            }

            // Create verification record
            const insertQuery = `
                INSERT INTO verifications (
                    user_id,
                    verification_type,
                    id_document_url,
                    status
                ) VALUES ($1, $2, $3, $4)
                RETURNING *
            `;
            const result = await pool.query(insertQuery, [
                userId,
                'id',
                filePath,
                'pending'
            ]);

            res.status(201).json({
                success: true,
                message: 'ID verification submitted successfully. Please wait for admin review.',
                data: {
                    verificationId: result.rows[0].id,
                    status: 'pending',
                    submittedAt: result.rows[0].created_at
                }
            });

        } catch (error) {
            console.error('Error uploading ID verification:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to upload ID verification',
                details: error.message
            });
        }
    }

    /**
     * GET /api/verifications/status
     * Get verification status for current user
     */
    async getVerificationStatus(req, res) {
        try {
            const userId = req.user.id;

            const query = `
                SELECT
                    verification_type,
                    status,
                    created_at,
                    reviewed_at,
                    rejection_reason
                FROM verifications
                WHERE user_id = $1
                ORDER BY created_at DESC
            `;
            const result = await pool.query(query, [userId]);

            // Organize by verification type
            const verifications = {
                phone: { verified: req.user.phone_verified || false },
                photo: { verified: false, status: null },
                id: { verified: false, status: null }
            };

            result.rows.forEach(row => {
                if (row.verification_type === 'photo') {
                    verifications.photo = {
                        verified: row.status === 'approved',
                        status: row.status,
                        submittedAt: row.created_at,
                        reviewedAt: row.reviewed_at,
                        rejectionReason: row.rejection_reason
                    };
                } else if (row.verification_type === 'id') {
                    verifications.id = {
                        verified: row.status === 'approved',
                        status: row.status,
                        submittedAt: row.created_at,
                        reviewedAt: row.reviewed_at,
                        rejectionReason: row.rejection_reason
                    };
                }
            });

            res.json({
                success: true,
                data: verifications
            });

        } catch (error) {
            console.error('Error getting verification status:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get verification status'
            });
        }
    }

    // ========================================================================
    // ADMIN ENDPOINTS
    // ========================================================================

    /**
     * GET /api/admin/verifications/pending
     * Get all pending verifications (admin only)
     */
    async getPendingVerifications(req, res) {
        try {
            const { type } = req.query; // Filter by type: 'photo' or 'id'

            let query = `
                SELECT
                    v.*,
                    u.phone_number,
                    p.first_name,
                    p.last_name,
                    p.gender,
                    p.date_of_birth,
                    p.photo_urls
                FROM verifications v
                JOIN users u ON v.user_id = u.id
                LEFT JOIN profiles p ON v.user_id = p.user_id
                WHERE v.status = 'pending'
            `;

            const params = [];
            if (type) {
                query += ` AND v.verification_type = $1`;
                params.push(type);
            }

            query += ` ORDER BY v.created_at ASC`;

            const result = await pool.query(query, params);

            const verifications = result.rows.map(row => ({
                verificationId: row.id,
                userId: row.user_id,
                verificationType: row.verification_type,
                status: row.status,
                selfieUrl: row.selfie_url,
                idDocumentUrl: row.id_document_url,
                submittedAt: row.created_at,
                user: {
                    phoneNumber: row.phone_number,
                    firstName: row.first_name,
                    lastName: row.last_name,
                    gender: row.gender,
                    dateOfBirth: row.date_of_birth,
                    profilePhotos: row.photo_urls
                }
            }));

            res.json({
                success: true,
                data: verifications,
                count: verifications.length
            });

        } catch (error) {
            console.error('Error getting pending verifications:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get pending verifications'
            });
        }
    }

    /**
     * POST /api/admin/verifications/:verificationId/approve
     * Approve a verification (admin only)
     */
    async approveVerification(req, res) {
        try {
            const { verificationId } = req.params;
            const { notes } = req.body;
            const adminId = req.admin.id;

            // Get verification details
            const verificationQuery = 'SELECT * FROM verifications WHERE id = $1';
            const verificationResult = await pool.query(verificationQuery, [verificationId]);

            if (verificationResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Verification not found'
                });
            }

            const verification = verificationResult.rows[0];

            if (verification.status !== 'pending') {
                return res.status(400).json({
                    success: false,
                    error: `Verification is not pending. Current status: ${verification.status}`
                });
            }

            // Update verification
            const updateQuery = `
                UPDATE verifications
                SET status = 'approved',
                    reviewed_by = $1,
                    reviewed_at = CURRENT_TIMESTAMP,
                    admin_notes = $2,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $3
                RETURNING *
            `;
            await pool.query(updateQuery, [adminId, notes, verificationId]);

            // Log admin action
            const { logAdminAction } = require('../middleware/adminMiddleware');
            await logAdminAction(
                adminId,
                'approve_verification',
                verification.user_id,
                notes || 'Verification approved',
                {
                    entityType: 'verification',
                    entityId: verificationId,
                    verificationType: verification.verification_type
                },
                req.admin.ipAddress,
                req.admin.userAgent
            );

            // TODO: Send notification to user (Phase 8)

            res.json({
                success: true,
                message: 'Verification approved successfully'
            });

        } catch (error) {
            console.error('Error approving verification:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to approve verification'
            });
        }
    }

    /**
     * POST /api/admin/verifications/:verificationId/reject
     * Reject a verification (admin only)
     */
    async rejectVerification(req, res) {
        try {
            const { verificationId } = req.params;
            const { reason, notes } = req.body;
            const adminId = req.admin.id;

            if (!reason) {
                return res.status(400).json({
                    success: false,
                    error: 'Rejection reason is required'
                });
            }

            // Get verification details
            const verificationQuery = 'SELECT * FROM verifications WHERE id = $1';
            const verificationResult = await pool.query(verificationQuery, [verificationId]);

            if (verificationResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Verification not found'
                });
            }

            const verification = verificationResult.rows[0];

            if (verification.status !== 'pending') {
                return res.status(400).json({
                    success: false,
                    error: `Verification is not pending. Current status: ${verification.status}`
                });
            }

            // Update verification
            const updateQuery = `
                UPDATE verifications
                SET status = 'rejected',
                    reviewed_by = $1,
                    reviewed_at = CURRENT_TIMESTAMP,
                    rejection_reason = $2,
                    admin_notes = $3,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $4
                RETURNING *
            `;
            await pool.query(updateQuery, [adminId, reason, notes, verificationId]);

            // Log admin action
            const { logAdminAction } = require('../middleware/adminMiddleware');
            await logAdminAction(
                adminId,
                'reject_verification',
                verification.user_id,
                reason,
                {
                    entityType: 'verification',
                    entityId: verificationId,
                    verificationType: verification.verification_type
                },
                req.admin.ipAddress,
                req.admin.userAgent
            );

            // TODO: Send notification to user (Phase 8)

            res.json({
                success: true,
                message: 'Verification rejected'
            });

        } catch (error) {
            console.error('Error rejecting verification:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to reject verification'
            });
        }
    }

    /**
     * GET /api/admin/verifications/stats
     * Get verification statistics (admin only)
     */
    async getVerificationStats(req, res) {
        try {
            const query = `
                SELECT
                    verification_type,
                    status,
                    COUNT(*) as count
                FROM verifications
                GROUP BY verification_type, status
                ORDER BY verification_type, status
            `;
            const result = await pool.query(query);

            // Organize stats
            const stats = {
                photo: { pending: 0, approved: 0, rejected: 0 },
                id: { pending: 0, approved: 0, rejected: 0 }
            };

            result.rows.forEach(row => {
                if (stats[row.verification_type]) {
                    stats[row.verification_type][row.status] = parseInt(row.count);
                }
            });

            // Get total users with each verification
            const userStatsQuery = `
                SELECT
                    COUNT(DISTINCT CASE WHEN v_photo.status = 'approved' THEN v_photo.user_id END) as photo_verified_users,
                    COUNT(DISTINCT CASE WHEN v_id.status = 'approved' THEN v_id.user_id END) as id_verified_users,
                    COUNT(DISTINCT u.id) as total_users
                FROM users u
                LEFT JOIN verifications v_photo ON u.id = v_photo.user_id AND v_photo.verification_type = 'photo'
                LEFT JOIN verifications v_id ON u.id = v_id.user_id AND v_id.verification_type = 'id'
            `;
            const userStatsResult = await pool.query(userStatsQuery);
            const userStats = userStatsResult.rows[0];

            res.json({
                success: true,
                data: {
                    verificationCounts: stats,
                    userStats: {
                        totalUsers: parseInt(userStats.total_users),
                        photoVerifiedUsers: parseInt(userStats.photo_verified_users),
                        idVerifiedUsers: parseInt(userStats.id_verified_users),
                        photoVerificationRate: userStats.total_users > 0
                            ? Math.round((userStats.photo_verified_users / userStats.total_users) * 100)
                            : 0,
                        idVerificationRate: userStats.total_users > 0
                            ? Math.round((userStats.id_verified_users / userStats.total_users) * 100)
                            : 0
                    }
                }
            });

        } catch (error) {
            console.error('Error getting verification stats:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get verification statistics'
            });
        }
    }
}

module.exports = new VerificationController();
