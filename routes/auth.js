const express = require('express'); // Web framework for Node.js
const router = express.Router(); // Router object to handle routes
const bcrypt = require('bcryptjs'); // Library for hashing passwords
const jwt = require('jsonwebtoken'); // Library for creating JSON Web Tokens
const pool = require('../db/postgre'); // Custom module for PostgreSQL connection pool
const crypto = require('crypto');

const locationService = require('../services/locationService');
const authorizationService = require('../services/authorizationService');
const passport = require('passport');
const { validateLogin, validateAccess } = require('../middleware/validation');

// JWT signing options with explicit algorithm
const JWT_OPTIONS = { algorithm: 'HS256', expiresIn: '15m' };

/**
 * Hash a refresh token for secure storage
 */
async function hashToken(token) {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(token, salt);
}

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate a user based on username and password, and return a JWT upon success.
 * @access  Public
 */
router.post('/login', validateLogin, passport.authenticate('local', { session: false }), (req, res) => {
    // If this function gets called, authentication was successful.
    // `req.user` contains the authenticated user.
    const payload = {
        user: {
            id: req.user.id,
            role: req.user.role
        }
    };

    jwt.sign(
        payload,
        process.env.JWT_SECRET,
        JWT_OPTIONS,
        (err, token) => {
            if (err) throw err;
            res.json({ token });
        }
    );
});


/**
 * @route   POST /api/auth/access
 * @desc    Orchestrate location-based authentication and authorization.
 * @access  Public
 */
router.post('/access', validateAccess, (req, res, next) => {
    passport.authenticate('local', { session: false }, async (err, user, info) => {
        if (err) {
            return next(err);
        }
        if (!user) {
            return res.status(400).json({ msg: info.message || 'Invalid credentials' });
        }

        const startTime = Date.now();
        const { latitude, longitude } = req.body;

        let isLocationVerified = false;
        let spoofingCheckResult = { isSpoofed: false };
        let authorizationResult = { access: 'denied' };

        try {
            const ip = req.headers['x-forwarded-for'] || req.ip;

            if (user.role !== 'admin') {
                spoofingCheckResult = await locationService.isLocationSpoofed(ip, latitude, longitude);
            }

            if (!spoofingCheckResult.isSpoofed) {
                const { isVerified, zoneName } = await locationService.verifyLocation({ latitude, longitude }, user.id);
                isLocationVerified = isVerified;

                authorizationResult = await authorizationService.grantAccess(user, isLocationVerified);

                if (authorizationResult.access === 'granted') {
                    authorizationResult.zoneName = zoneName;
                }
            }

            const latency = Date.now() - startTime;

            const logQuery = `
                INSERT INTO auth_logs(user_id, client_latitude, client_longitude, ip_address, ip_latitude, ip_longitude, is_location_verified, is_spoofed, access_granted, latency)
                VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `;
            await pool.query(logQuery, [
                user.id, latitude, longitude, ip, spoofingCheckResult.ipLatitude,
                spoofingCheckResult.ipLongitude, isLocationVerified,
                spoofingCheckResult.isSpoofed, authorizationResult.access === 'granted', latency
            ]);

            if (authorizationResult.access === 'granted') {
                const payload = { user: { id: user.id, role: user.role } };
                const accessToken = jwt.sign(payload, process.env.JWT_SECRET, JWT_OPTIONS);
                const refreshToken = crypto.randomBytes(64).toString('hex');
                const hashedRefreshToken = await hashToken(refreshToken);
                const refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

                await pool.query(
                    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
                    [user.id, hashedRefreshToken, refreshTokenExpiry]
                );

                res.cookie('refreshToken', refreshToken, {
                    httpOnly: true,
                    secure: true, // Always use secure cookies
                    expires: refreshTokenExpiry,
                    sameSite: 'strict'
                });

                // Fetch all auth logs for the user
                const authLogsRes = await pool.query('SELECT * FROM auth_logs WHERE user_id = $1 ORDER BY timestamp DESC', [user.id]);

                res.json({
                    ...authorizationResult,
                    token: accessToken,
                    authLogs: authLogsRes.rows
                });
            } else {
                if (spoofingCheckResult.isSpoofed) {
                    let msg = 'Access denied due to potential location spoofing.';
                    if (spoofingCheckResult.reason === 'proxy') {
                        msg = 'Access from a VPN or proxy is not allowed.';
                    } else if (spoofingCheckResult.reason === 'distance') {
                        msg = 'Your reported location is too far from your network location.';
                    }
                    return res.status(403).json({ msg });
                }
                if (!isLocationVerified) {
                    return res.status(403).json({ msg: 'Access denied. You are not in an authorized location.' });
                }
                res.status(400).json({ msg: 'Authorization failed after location check.' });
            }
        } catch (error) {
            console.error('Access error:', error.message);
            res.status(500).send('Server error during location verification.');
        }
    })(req, res, next);
});

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh the access token using a refresh token.
 * @access  Public (requires a valid refresh token cookie)
 */
router.post('/refresh', async (req, res) => {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
        return res.status(401).json({ msg: 'No refresh token provided.' });
    }

    try {
        // Find all non-expired refresh tokens for comparison
        const tokensResult = await pool.query(
            'SELECT * FROM refresh_tokens WHERE expires_at > NOW()'
        );

        let matchedToken = null;
        for (const storedToken of tokensResult.rows) {
            const isMatch = await bcrypt.compare(refreshToken, storedToken.token);
            if (isMatch) {
                matchedToken = storedToken;
                break;
            }
        }

        if (!matchedToken) {
            return res.status(403).json({ msg: 'Invalid refresh token.' });
        }

        // Get user for the new payload
        const userResult = await pool.query('SELECT id, role FROM users WHERE id = $1', [matchedToken.user_id]);
        if (userResult.rows.length === 0) {
            return res.status(403).json({ msg: 'User not found.' });
        }
        const user = userResult.rows[0];

        // --- Refresh Token Rotation ---

        // 1. Delete the old refresh token
        await pool.query('DELETE FROM refresh_tokens WHERE id = $1', [matchedToken.id]);

        // 2. Create a new access token
        const payload = { user: { id: user.id, role: user.role } };
        const newAccessToken = jwt.sign(payload, process.env.JWT_SECRET, JWT_OPTIONS);

        // 3. Create a new refresh token
        const newRefreshToken = crypto.randomBytes(64).toString('hex');
        const hashedNewRefreshToken = await hashToken(newRefreshToken);
        const newRefreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        // 4. Store the new refresh token in the database
        await pool.query(
            'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
            [user.id, hashedNewRefreshToken, newRefreshTokenExpiry]
        );

        // 5. Send the new refresh token in the cookie
        res.cookie('refreshToken', newRefreshToken, {
            httpOnly: true,
            secure: true, // Always use secure cookies
            expires: newRefreshTokenExpiry,
            sameSite: 'strict'
        });

        // 6. Send the new access token
        res.json({ token: newAccessToken });

    } catch (err) {
        console.error('Refresh error:', err.message);
        res.status(500).send('Server error');
    }
});


/**
 * @route   POST /api/auth/logout
 * @desc    Logout user and invalidate refresh token.
 * @access  Public (requires a valid refresh token cookie)
 */
router.post('/logout', async (req, res) => {
    const refreshToken = req.cookies.refreshToken;

    if (refreshToken) {
        try {
            // Find and delete the matching hashed token
            const tokensResult = await pool.query('SELECT * FROM refresh_tokens');
            for (const storedToken of tokensResult.rows) {
                const isMatch = await bcrypt.compare(refreshToken, storedToken.token);
                if (isMatch) {
                    await pool.query('DELETE FROM refresh_tokens WHERE id = $1', [storedToken.id]);
                    break;
                }
            }
        } catch (err) {
            console.error('Logout error:', err.message);
        }
    }

    // Clear the refresh token cookie
    res.clearCookie('refreshToken');
    res.status(200).json({ msg: 'Logged out successfully.' });
});

module.exports = router;
