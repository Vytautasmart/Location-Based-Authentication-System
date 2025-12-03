
const express = require('express');
const router = express.Router();
const pool = require('../db/postgre');

// @route   POST /api/zones
// @desc    Create a new authorized zone
// @access  Private (TODO: Add authentication middleware)
router.post('/', async (req, res) => {
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
