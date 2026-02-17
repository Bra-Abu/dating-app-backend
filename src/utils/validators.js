// Validation Schemas using Joi
const Joi = require('joi');

// Profile Creation/Update Validation
const profileSchema = Joi.object({
    // Basic Information
    first_name: Joi.string().min(2).max(100).required(),
    last_name: Joi.string().min(2).max(100).required(),
    date_of_birth: Joi.date().max('now').required(),
    gender: Joi.string().valid('male', 'female').required(),
    bio: Joi.string().max(1000).allow('', null),

    // Religious/Cultural Information
    religion: Joi.string().valid(
        'Islam', 'Christianity', 'Judaism', 'Hinduism', 'Buddhism', 'Other', 'Prefer not to say'
    ).allow(null),
    denomination: Joi.string().max(100).allow('', null),
    religiosity_level: Joi.string().valid(
        'Very Religious', 'Religious', 'Moderately Religious', 'Spiritual', 'Not Religious'
    ).allow(null),
    tribe: Joi.string().max(100).allow('', null),
    ethnicity: Joi.string().max(100).allow('', null),
    languages: Joi.array().items(Joi.string()).allow(null),

    // Physical Attributes
    height: Joi.number().integer().min(100).max(250).allow(null), // cm
    complexion: Joi.string().valid(
        'Very Fair', 'Fair', 'Medium', 'Olive', 'Brown', 'Dark Brown', 'Very Dark'
    ).allow(null),
    body_type: Joi.string().valid(
        'Slim', 'Athletic', 'Average', 'Muscular', 'Curvy', 'Heavy'
    ).allow(null),

    // Professional Information
    occupation: Joi.string().max(200).allow('', null),
    education: Joi.string().valid(
        'High School', 'Associate Degree', 'Bachelor Degree', 'Master Degree',
        'Doctorate', 'Professional Degree', 'Trade School', 'Other'
    ).allow(null),
    income_range: Joi.string().valid(
        'Prefer not to say', 'Below $25k', '$25k-$50k', '$50k-$75k',
        '$75k-$100k', '$100k-$150k', '$150k-$200k', 'Above $200k'
    ).allow(null),
    work_status: Joi.string().valid(
        'Employed Full-time', 'Employed Part-time', 'Self-employed',
        'Student', 'Unemployed', 'Retired'
    ).allow(null),

    // Lifestyle
    smoking: Joi.string().valid('Never', 'Occasionally', 'Regularly', 'Quit').allow(null),
    drinking: Joi.string().valid('Never', 'Socially', 'Occasionally', 'Regularly').allow(null),
    diet: Joi.string().valid(
        'No Restrictions', 'Halal', 'Kosher', 'Vegetarian', 'Vegan', 'Pescatarian'
    ).allow(null),
    exercise: Joi.string().valid(
        'Daily', 'Several times a week', 'Once a week', 'Occasionally', 'Never'
    ).allow(null),

    // Family & Relationship
    marital_status: Joi.string().valid(
        'Never Married', 'Divorced', 'Widowed', 'Separated'
    ).allow(null),
    has_children: Joi.boolean().allow(null),
    number_of_children: Joi.number().integer().min(0).max(20).allow(null),
    want_children: Joi.string().valid(
        'Definitely Yes', 'Probably Yes', 'Undecided', 'Probably No', 'Definitely No'
    ).allow(null),
    living_situation: Joi.string().valid(
        'Live Alone', 'With Parents', 'With Roommates', 'With Children', 'Other'
    ).allow(null),
    relationship_goals: Joi.string().valid(
        'Marriage', 'Long-term Relationship', 'Friendship First', 'Undecided'
    ).allow(null),

    // Guardian Information (for Muslim women)
    has_guardian: Joi.boolean().allow(null),
    guardian_name: Joi.string().max(200).allow('', null),
    guardian_phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).allow('', null),
    guardian_relationship: Joi.string().max(100).allow('', null),

    // Location
    city: Joi.string().max(200).allow('', null),
    state: Joi.string().max(100).allow('', null),
    country: Joi.string().max(100).default('Nigeria'),
    latitude: Joi.number().min(-90).max(90).allow(null),
    longitude: Joi.number().min(-180).max(180).allow(null),

    // Photos
    photo_urls: Joi.array().items(Joi.string().uri()).allow(null),

    // Preferences
    preferences: Joi.object({
        age_min: Joi.number().integer().min(18).max(100),
        age_max: Joi.number().integer().min(18).max(100),
        height_min: Joi.number().integer().min(100).max(250),
        height_max: Joi.number().integer().min(100).max(250),
        religions: Joi.array().items(Joi.string()),
        denominations: Joi.array().items(Joi.string()),
        tribes: Joi.array().items(Joi.string()),
        education_levels: Joi.array().items(Joi.string()),
        max_distance_km: Joi.number().min(1).max(10000),
        must_have_children: Joi.boolean(),
        must_want_children: Joi.boolean(),
        acceptable_marital_status: Joi.array().items(Joi.string())
    }).allow(null)
});

// Profile Update Schema (all fields optional)
const profileUpdateSchema = profileSchema.fork(
    Object.keys(profileSchema.describe().keys),
    (schema) => schema.optional()
);

// Invite Code Validation
const inviteCodeSchema = Joi.object({
    code: Joi.string().pattern(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/).required()
        .messages({
            'string.pattern.base': 'Invalid invite code format. Expected: XXXX-XXXX'
        })
});

// Registration Validation
const registrationSchema = Joi.object({
    idToken: Joi.string().required(),
    inviteCode: Joi.string().pattern(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/).required()
});

// Login Validation
const loginSchema = Joi.object({
    idToken: Joi.string().required()
});

// Admin Action Validation
const adminApprovalSchema = Joi.object({
    reason: Joi.string().max(500).allow('', null)
});

const adminRejectionSchema = Joi.object({
    reason: Joi.string().max(500).required()
});

const adminSuspensionSchema = Joi.object({
    reason: Joi.string().max(500).required(),
    duration: Joi.number().integer().min(1).allow(null) // days
});

// Helper function to validate request body
const validateRequest = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body, {
            abortEarly: false, // Get all errors at once
            stripUnknown: true // Remove unknown fields
        });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));

            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: errors
            });
        }

        // Replace req.body with validated value
        req.body = value;
        next();
    };
};

module.exports = {
    profileSchema,
    profileUpdateSchema,
    inviteCodeSchema,
    registrationSchema,
    loginSchema,
    adminApprovalSchema,
    adminRejectionSchema,
    adminSuspensionSchema,
    validateRequest
};
