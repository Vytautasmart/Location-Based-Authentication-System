const express = require('express');
const router = express.Router();
const pool = require('../db/postgre');
const auth = require('../middleware/auth');

// @route   POST /api/zones
// @desc    Create a new authorized zone
// @access  Private
router.post('/', auth, async (req, res) => {
    // Check if user is admin
    if (req.user.role !== 'admin') {
        return res.status(403).json({ msg: 'Access denied. Only admins can create zones.' });
    }

    const { name, latitude, longitude, radius } = req.body;

    if (!name || !latitude || !longitude || !radius) {
        return res.status(400).json({ msg: 'Please provide name, latitude, longitude, and radius' });
    }

    try {
        const newZone = await pool.query(
            'INSERT INTO authorized_zones (name, latitude, longitude, radius) VALUES ($1, $2, $3, $4) RETURNING *',
            [name, latitude, longitude, radius]
        );
        res.json(newZone.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

module.exports = router;
