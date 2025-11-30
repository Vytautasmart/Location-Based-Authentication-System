const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const settings = require('../settings.json');

// This is a mock user. In a real application, you would fetch this from your database.
const mockUser = {
    id: 1,
    email: 'test@example.com',
    // In a real scenario, this hash would be generated during user registration
    // using bcrypt.hashSync('password123', 10)
    passwordHash: '$2a$10$f/3v..9gC.2f4xJ5a5w3AuffoT5O4D3l2CjICp3u.EaJtq.a5iG1m' 
};

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and return JWT
 * @access  Public
 */
router.post('/login', (req, res) => {
    const { email, password } = req.body;

    // Basic validation
    if (!email || !password) {
        return res.status(400).json({ msg: 'Please enter all fields' });
    }

    // In a real app, you'd find the user by email in your database.
    // For this example, we'll use our mock user.
    if (email !== mockUser.email) {
        return res.status(400).json({ msg: 'Invalid credentials' });
    }

    // Validate password
    bcrypt.compare(password, mockUser.passwordHash).then(isMatch => {
        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        // If credentials are valid, create JWT payload
        const payload = {
            user: {
                id: mockUser.id
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
    });
});

module.exports = router;
