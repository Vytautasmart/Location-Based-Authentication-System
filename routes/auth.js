// Import necessary packages
const express = require('express'); // Web framework for Node.js
const router = express.Router(); // Router object to handle routes
const bcrypt = require('bcryptjs'); // Library for hashing passwords
const jwt = require('jsonwebtoken'); // Library for creating JSON Web Tokens
const pool = require('../db/postgre'); // Custom module for PostgreSQL connection pool
const settings = require('../settings.json'); // Application settings, including JWT secret

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
                id: user.id 
            }
        };

        // Sign the token with the payload, a secret key from settings, and set an expiration time.
        jwt.sign(
            payload,
            settings.jwt_secret,
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

module.exports = router;
