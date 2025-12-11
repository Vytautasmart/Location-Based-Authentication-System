const express = require('express');
const router = express.Router();
const pool = require('../db/postgre');
const auth = require('../middleware/auth');

// @route   GET /api/zones
// @desc    Get all authorized zones
// @access  Public
router.get('/', async (req, res) => {
    try {
        const zones = await pool.query('SELECT * FROM authorized_zones');
        res.json(zones.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

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


// @route   PUT /api/zones/:id
// @desc    Update an authorized zone
// @access  Private
router.put('/:id', auth, async (req, res) => {
    // Check if user is admin
    if (req.user.role !== 'admin') {
        return res.status(403).json({ msg: 'Access denied. Only admins can update zones.' });
    }

    const { name, latitude, longitude, radius } = req.body;
    const { id } = req.params;

    if (!name || !latitude || !longitude || !radius) {
        return res.status(400).json({ msg: 'Please provide name, latitude, longitude, and radius' });
    }

    try {
        const updatedZone = await pool.query(
            'UPDATE authorized_zones SET name = $1, latitude = $2, longitude = $3, radius = $4 WHERE id = $5 RETURNING *',
            [name, latitude, longitude, radius, id]
        );
        res.json(updatedZone.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   DELETE /api/zones/:id
// @desc    Delete an authorized zone
// @access  Private
router.delete('/:id', auth, async (req, res) => {
    // Check if user is admin
    if (req.user.role !== 'admin') {
        return res.status(403).json({ msg: 'Access denied. Only admins can delete zones.' });
    }

    const { id } = req.params;

    try {
        await pool.query('DELETE FROM authorized_zones WHERE id = $1', [id]);
        res.json({ msg: 'Zone deleted successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

module.exports = router;
