// Admin Middleware - Verify admin permissions
const pool = require('../config/database');

/**
 * Middleware to require admin or super_admin role
 * Use AFTER verifyToken middleware
 */
const requireAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
    }

    const allowedRoles = ['admin', 'super_admin'];

    if (!allowedRoles.includes(req.user.account_type)) {
        return res.status(403).json({
            success: false,
            error: 'Access denied. Admin privileges required.',
            requiredRole: 'admin'
        });
    }

    next();
};

/**
 * Middleware to require super_admin role only
 * Use for highly sensitive operations
 */
const requireSuperAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
    }

    if (req.user.account_type !== 'super_admin') {
        return res.status(403).json({
            success: false,
            error: 'Access denied. Super admin privileges required.',
            requiredRole: 'super_admin'
        });
    }

    next();
};

/**
 * Log admin action to database for audit trail
 * Call this function in admin controllers after successful actions
 */
const logAdminAction = async (adminId, actionType, targetUserId = null, reason = null, details = null, ipAddress = null, userAgent = null) => {
    try {
        const query = `
            INSERT INTO admin_actions (
                admin_id,
                action_type,
                target_user_id,
                target_entity_type,
                target_entity_id,
                reason,
                details,
                ip_address,
                user_agent
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `;

        const values = [
            adminId,
            actionType,
            targetUserId,
            details?.entityType || null,
            details?.entityId || null,
            reason,
            details ? JSON.stringify(details) : null,
            ipAddress,
            userAgent
        ];

        const result = await pool.query(query, values);
        return result.rows[0];
    } catch (error) {
        console.error('Error logging admin action:', error);
        // Don't throw error - logging failure shouldn't break the request
        return null;
    }
};

/**
 * Middleware to extract IP and user agent for admin action logging
 * Attaches them to req.admin for use in controllers
 */
const captureAdminContext = (req, res, next) => {
    if (req.user) {
        req.admin = {
            ...req.user,
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.headers['user-agent'] || 'Unknown'
        };
    }
    next();
};

module.exports = {
    requireAdmin,
    requireSuperAdmin,
    logAdminAction,
    captureAdminContext
};
