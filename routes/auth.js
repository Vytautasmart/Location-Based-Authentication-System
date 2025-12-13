const express = require('express'); // Web framework for Node.js
const router = express.Router(); // Router object to handle routes
const bcrypt = require('bcryptjs'); // Library for hashing passwords
const jwt = require('jsonwebtoken'); // Library for creating JSON Web Tokens
const pool = require('../db/postgre'); // Custom module for PostgreSQL connection pool
const crypto = require('crypto');

const locationService = require('../services/locationService');
const authorizationService = require('../services/authorizationService');
const passport = require('passport');

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate a user based on username and password, and return a JWT upon success.
 * @access  Public
 */
router.post('/login', passport.authenticate('local', { session: false }), (req, res) => {
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
        { expiresIn: '15m' }, // Short-lived access token
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
router.post('/access', (req, res, next) => {
    passport.authenticate('local', { session: false }, async (err, user, info) => {
        if (err) {
            return next(err);
        }
        if (!user) {
            return res.status(400).json({ msg: info.message || 'Invalid credentials' });
        }

        console.log('--- New Login Attempt ---');
        console.log('Request Body:', req.body);
        console.log('Authenticated User (from Passport):', user);

        const startTime = Date.now();
        const { latitude, longitude } = req.body;

        if (!latitude || !longitude) {
            return res.status(400).json({ msg: 'Please provide latitude and longitude' });
        }

        let isLocationVerified = false;
        let spoofingCheckResult = { isSpoofed: false };
        let authorizationResult = { access: 'denied' };
        
        try {
            const ip = req.headers['x-forwarded-for'] || req.ip;
            console.log('User IP:', ip);

            if (user.role !== 'admin') {
                spoofingCheckResult = await locationService.isLocationSpoofed(ip, latitude, longitude);
                console.log('Spoofing Check Result:', spoofingCheckResult);
            } else {
                console.log('Skipping spoofing check for admin user.');
            }

            if (!spoofingCheckResult.isSpoofed) {
                isLocationVerified = await locationService.verifyLocation({ latitude, longitude });
                console.log('Location Verification Result:', isLocationVerified);

                authorizationResult = await authorizationService.grantAccess(user, isLocationVerified);
                console.log('Authorization Result:', authorizationResult);
            }

            const latency = Date.now() - startTime;
            
            console.log('--- Logging to Database ---');
            const logQuery = `
                INSERT INTO auth_logs(user_id, client_latitude, client_longitude, ip_address, ip_latitude, ip_longitude, is_location_verified, is_spoofed, access_granted, latency)
                VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `;
            await pool.query(logQuery, [
                user.id, latitude, longitude, ip, spoofingCheckResult.ipLatitude, 
                spoofingCheckResult.ipLongitude, isLocationVerified, 
                spoofingCheckResult.isSpoofed, authorizationResult.access === 'granted', latency
            ]);
            console.log('--- Login Attempt Logged ---');

            if (authorizationResult.access === 'granted') {
                console.log('--- Access Granted: Generating Tokens ---');
                const payload = { user: { id: user.id, role: user.role } };
                const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' });
                const refreshToken = crypto.randomBytes(64).toString('hex');
                const refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

                await pool.query(
                    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
                    [user.id, refreshToken, refreshTokenExpiry]
                );

                res.cookie('refreshToken', refreshToken, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    expires: refreshTokenExpiry,
                    sameSite: 'strict'
                });

                console.log('--- Sending Response to Client ---');
                res.json({ ...authorizationResult, token: accessToken });
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
            console.error(error.message);
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
        // Find the refresh token in the database
        const tokenResult = await pool.query('SELECT * FROM refresh_tokens WHERE token = $1', [refreshToken]);

        if (tokenResult.rows.length === 0) {
            return res.status(403).json({ msg: 'Invalid refresh token.' });
        }

        const storedToken = tokenResult.rows[0];

        // Check if the token has expired
        if (new Date() > new Date(storedToken.expires_at)) {
            // Clean up expired token
            await pool.query('DELETE FROM refresh_tokens WHERE id = $1', [storedToken.id]);
            return res.status(403).json({ msg: 'Refresh token expired.' });
        }

        // Get user for the new payload
        const userResult = await pool.query('SELECT id, role FROM users WHERE id = $1', [storedToken.user_id]);
        if (userResult.rows.length === 0) {
            return res.status(403).json({ msg: 'User not found.' });
        }
        const user = userResult.rows[0];

        // --- Refresh Token Rotation ---
        
        // 1. Delete the old refresh token
        await pool.query('DELETE FROM refresh_tokens WHERE id = $1', [storedToken.id]);

        // 2. Create a new access token
        const payload = { user: { id: user.id, role: user.role } };
        const newAccessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' });

        // 3. Create a new refresh token
        const newRefreshToken = crypto.randomBytes(64).toString('hex');
        const newRefreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        // 4. Store the new refresh token in the database
        await pool.query(
            'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
            [user.id, newRefreshToken, newRefreshTokenExpiry]
        );

        // 5. Send the new refresh token in the cookie
        res.cookie('refreshToken', newRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            expires: newRefreshTokenExpiry,
            sameSite: 'strict'
        });

        // 6. Send the new access token
        res.json({ token: newAccessToken });

    } catch (err) {
        console.error(err.message);
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
        // Delete the refresh token from the database
        await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
    }

    // Clear the refresh token cookie
    res.clearCookie('refreshToken');
    res.status(200).json({ msg: 'Logged out successfully.' });
});

module.exports = router;
