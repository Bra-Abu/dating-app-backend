// Rate Limiter Middleware - Prevent spam and abuse
const rateLimit = require('express-rate-limit');
const pool = require('../config/database');

// General API rate limiter
const apiLimiter = rateLimit({
    windowMs: parseInt(process.env.API_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.API_RATE_LIMIT_MAX_REQUESTS) || 500, // 500 requests per window
    message: {
        success: false,
        error: 'Too many requests, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Strict limiter for auth endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 attempts
    message: {
        success: false,
        error: 'Too many authentication attempts, please try again after 15 minutes.'
    }
});

// Like rate limiter (custom - uses database)
const likeLimiter = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const limitPerDay = parseInt(process.env.LIKE_LIMIT_PER_DAY) || 50;

        // Count likes in last 24 hours
        const query = `
            SELECT COUNT(*) as count
            FROM activity_log
            WHERE user_id = $1
              AND activity_type = 'like'
              AND created_at > NOW() - INTERVAL '24 hours'
        `;

        const result = await pool.query(query, [userId]);
        const likesCount = parseInt(result.rows[0].count);

        if (likesCount >= limitPerDay) {
            return res.status(429).json({
                success: false,
                error: `You've reached your daily like limit of ${limitPerDay}. Please try again tomorrow.`,
                limit: limitPerDay,
                used: likesCount
            });
        }

        // Add remaining likes to response headers
        res.set('X-RateLimit-Limit', limitPerDay.toString());
        res.set('X-RateLimit-Remaining', (limitPerDay - likesCount).toString());

        next();

    } catch (error) {
        console.error('Error in like rate limiter:', error);
        // Don't block request on error
        next();
    }
};

// Message rate limiter (custom - uses database)
const messageLimiter = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const limitPerHour = parseInt(process.env.MESSAGE_LIMIT_PER_HOUR) || 100;

        // Count messages in last hour
        const query = `
            SELECT COUNT(*) as count
            FROM activity_log
            WHERE user_id = $1
              AND activity_type = 'message'
              AND created_at > NOW() - INTERVAL '1 hour'
        `;

        const result = await pool.query(query, [userId]);
        const messagesCount = parseInt(result.rows[0].count);

        if (messagesCount >= limitPerHour) {
            return res.status(429).json({
                success: false,
                error: `You've reached your hourly message limit of ${limitPerHour}. Please try again later.`,
                limit: limitPerHour,
                used: messagesCount
            });
        }

        res.set('X-RateLimit-Limit', limitPerHour.toString());
        res.set('X-RateLimit-Remaining', (limitPerHour - messagesCount).toString());

        next();

    } catch (error) {
        console.error('Error in message rate limiter:', error);
        next();
    }
};

// Report rate limiter
const reportLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 reports per hour
    message: {
        success: false,
        error: 'You can only submit 5 reports per hour. Please try again later.'
    }
});

// File upload rate limiter
const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 uploads per 15 minutes
    message: {
        success: false,
        error: 'Too many uploads. Please try again after 15 minutes.'
    }
});

// Pass rate limiter (prevent rapid passing)
const passLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 20, // 20 passes per minute
    message: {
        success: false,
        error: 'You\'re passing too quickly. Please slow down.'
    }
});

module.exports = {
    apiLimiter,
    authLimiter,
    likeLimiter,
    messageLimiter,
    reportLimiter,
    uploadLimiter,
    passLimiter
};
