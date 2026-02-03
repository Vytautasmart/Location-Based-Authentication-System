const express = require('express');
const router = express.Router();
const pool = require('../db/postgre');
const passport = require('passport');
const { checkRole } = require('../middleware/rbac');
const { validateZone, validateZoneId } = require('../middleware/validation');

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
router.post('/', [passport.authenticate('jwt', { session: false }), checkRole('admin'), ...validateZone], async (req, res) => {
    const { name, latitude, longitude, radius } = req.body;

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
router.put('/:id', [passport.authenticate('jwt', { session: false }), checkRole('admin'), ...validateZoneId, ...validateZone], async (req, res) => {
    const { name, latitude, longitude, radius } = req.body;
    const { id } = req.params;

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
router.delete('/:id', [passport.authenticate('jwt', { session: false }), checkRole('admin'), ...validateZoneId], async (req, res) => {
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
