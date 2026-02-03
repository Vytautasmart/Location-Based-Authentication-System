const { body, param, validationResult } = require('express-validator');

/**
 * Middleware to handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            msg: 'Validation failed',
            errors: errors.array().map(e => ({ field: e.path, message: e.msg }))
        });
    }
    next();
};

/**
 * Validation rules for login endpoint
 */
const validateLogin = [
    body('username')
        .isString()
        .trim()
        .isLength({ min: 3, max: 50 })
        .withMessage('Username must be between 3 and 50 characters'),
    body('password')
        .isString()
        .isLength({ min: 8, max: 128 })
        .withMessage('Password must be between 8 and 128 characters'),
    handleValidationErrors
];

/**
 * Validation rules for access endpoint (login + location)
 */
const validateAccess = [
    body('username')
        .isString()
        .trim()
        .isLength({ min: 3, max: 50 })
        .withMessage('Username must be between 3 and 50 characters'),
    body('password')
        .isString()
        .isLength({ min: 8, max: 128 })
        .withMessage('Password must be between 8 and 128 characters'),
    body('latitude')
        .isFloat({ min: -90, max: 90 })
        .withMessage('Latitude must be between -90 and 90'),
    body('longitude')
        .isFloat({ min: -180, max: 180 })
        .withMessage('Longitude must be between -180 and 180'),
    handleValidationErrors
];

/**
 * Validation rules for user registration
 */
const validateRegistration = [
    body('username')
        .isString()
        .trim()
        .isLength({ min: 3, max: 50 })
        .withMessage('Username must be between 3 and 50 characters')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('Username can only contain letters, numbers, and underscores'),
    body('password')
        .isString()
        .isLength({ min: 8, max: 128 })
        .withMessage('Password must be between 8 and 128 characters')
        .matches(/[a-z]/)
        .withMessage('Password must contain at least one lowercase letter')
        .matches(/[A-Z]/)
        .withMessage('Password must contain at least one uppercase letter')
        .matches(/[0-9]/)
        .withMessage('Password must contain at least one number')
        .matches(/[!@#$%^&*(),.?":{}|<>]/)
        .withMessage('Password must contain at least one special character'),
    handleValidationErrors
];

/**
 * Validation rules for creating/updating zones
 */
const validateZone = [
    body('name')
        .isString()
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage('Zone name must be between 1 and 100 characters'),
    body('latitude')
        .isFloat({ min: -90, max: 90 })
        .withMessage('Latitude must be between -90 and 90'),
    body('longitude')
        .isFloat({ min: -180, max: 180 })
        .withMessage('Longitude must be between -180 and 180'),
    body('radius')
        .isFloat({ min: 1, max: 100000 })
        .withMessage('Radius must be between 1 and 100000 meters'),
    handleValidationErrors
];

/**
 * Validation for zone ID parameter
 */
const validateZoneId = [
    param('id')
        .isInt({ min: 1 })
        .withMessage('Zone ID must be a positive integer'),
    handleValidationErrors
];

module.exports = {
    validateLogin,
    validateAccess,
    validateRegistration,
    validateZone,
    validateZoneId,
    handleValidationErrors
};
