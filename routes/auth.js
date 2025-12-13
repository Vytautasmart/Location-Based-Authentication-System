// Import necessary packages
const express = require('express'); // Web framework for Node.js
const router = express.Router(); // Router object to handle routes
const bcrypt = require('bcryptjs'); // Library for hashing passwords
const jwt = require('jsonwebtoken'); // Library for creating JSON Web Tokens
const pool = require('../db/postgre'); // Custom module for PostgreSQL connection pool

const locationService = require('../services/locationService');
const authorizationService = require('../services/authorizationService');

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate a user based on username and password, and return a JWT upon success.
 * @access  Public
 */
router.post('/login', async (req, res) => {
    // Destructure username and password from the request body
    const { username, password } = req.body;

    // A simple validation to ensure both fields are provided.
    if (!username || !password) {
        return res.status(400).json({ msg: 'Please enter all fields' });
    }

    try {
        // Query the database to find a user with the provided username.
        // We use a parameterized query ($1) to prevent SQL injection attacks.
        const userResult = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        
        // If no user is found in the database, return a generic "Invalid credentials" error.
        // This avoids telling a potential attacker that the username was correct.
        if (userResult.rows.length === 0) {
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        // The user was found, so we get the first row from the result.
        const user = userResult.rows[0];

        // Compare the plain-text password from the request with the hashed password from the database.
        // bcrypt.compare handles the salt and hashing comparison securely.
        const isMatch = await bcrypt.compare(password, user.password);

        // If the passwords do not match, return the same generic error.
        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        // If the credentials are valid, we create a payload for the JWT.
        // It's good practice to only include non-sensitive information, like the user ID.
        const payload = {
            user: {
                id: user.id,
                role: user.role
            }
        };

        // Sign the token with the payload, a secret key from settings, and set an expiration time.
        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: 3600 }, // The token will expire in 1 hour (3600 seconds)
            (err, token) => {
                if (err) throw err;
                // Send the generated token back to the client.
                res.json({
                    token
                });
            }
        );
    } catch (err) {
        // If any server-side error occurs, log it and send a generic 500 status.
        console.error(err.message);
        res.status(500).send('Server error');
    }
});


/**
 * @route   POST /api/auth/access
 * @desc    Orchestrate location-based authentication and authorization.
 * @access  Public
 */
router.post('/access', async (req, res) => {
    const startTime = Date.now();
    // Destructure credentials and location data from the request body
    const { username, password, latitude, longitude } = req.body;

    // Validate essential inputs
    if (!username || !password || !latitude || !longitude) {
        return res.status(400).json({ msg: 'Please provide username, password, and location' });
    }

    let user;
    let isMatch = false;
    let isLocationVerified = false;
    let spoofingCheckResult = { isSpoofed: false, ipLatitude: null, ipLongitude: null, distance: null };
    let authorizationResult = { access: 'denied' };

    try {
        // --- Step 1: Standard User Authentication ---
        const userResult = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (userResult.rows.length > 0) {
            user = userResult.rows[0];
            isMatch = await bcrypt.compare(password, user.password);
        }

        const ip = req.headers['x-forwarded-for'] || req.ip;

        if (user && isMatch) {
            // Bipass spoofing check for admin users
            if (user.role !== 'admin') {
                // --- Step 2: Location Spoofing Check ---
                spoofingCheckResult = await locationService.isLocationSpoofed(ip, latitude, longitude);
            }

            if (!spoofingCheckResult.isSpoofed) {
                // --- Step 3: Location Verification ---
                isLocationVerified = await locationService.verifyLocation({ latitude, longitude });

                // --- Step 4: Authorization ---
                authorizationResult = await authorizationService.grantAccess(user, isLocationVerified);
            }
        }

        const latency = Date.now() - startTime;
        
        // --- Log the attempt ---
        const logQuery = `
            INSERT INTO auth_logs(user_id, client_latitude, client_longitude, ip_address, ip_latitude, ip_longitude, is_location_verified, is_spoofed, access_granted, latency)
            VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `;
        const logValues = [
            user ? user.id : null,
            latitude,
            longitude,
            ip,
            spoofingCheckResult.ipLatitude,
            spoofingCheckResult.ipLongitude,
            isLocationVerified,
            spoofingCheckResult.isSpoofed,
            authorizationResult.access === 'granted',
            latency
        ];
        await pool.query(logQuery, logValues);

        // --- Step 5: Respond to the client ---
        if (authorizationResult.access === 'granted') {
            const payload = { user: { id: user.id, role: user.role } };
            jwt.sign(
                payload,
                process.env.JWT_SECRET,
                { expiresIn: 3600 },
                (err, token) => {
                    if (err) throw err;
                    res.json({
                        ...authorizationResult,
                        token
                    });
                }
            );
        } else {
             if (spoofingCheckResult.isSpoofed) {
                return res.status(403).json({ msg: 'Access denied due to potential location spoofing.' });
            }
            if (!isLocationVerified) {
                return res.status(403).json({ msg: 'Access denied. You are not in an authorized location.' });
            }
            res.status(400).json({ msg: 'Invalid credentials' });
        }

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

module.exports = router;
