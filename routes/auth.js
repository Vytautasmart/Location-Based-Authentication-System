const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/postgre');
const settings = require('../settings.json');

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and return JWT
 * @access  Public
 */
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    // Basic validation
    if (!username || !password) {
        return res.status(400).json({ msg: 'Please enter all fields' });
    }

    try {
        // Check for existing user
        const userResult = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        
        if (userResult.rows.length === 0) {
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        const user = userResult.rows[0];

        // Validate password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        // If credentials are valid, create JWT payload
        const payload = {
            user: {
                id: user.id 
            }
        };

        // Sign the token
        jwt.sign(
            payload,
            settings.jwt_secret,
            { expiresIn: 3600 }, // Expires in 1 hour
            (err, token) => {
                if (err) throw err;
                res.json({
                    token
                });
            }
        );
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

module.exports = router;

