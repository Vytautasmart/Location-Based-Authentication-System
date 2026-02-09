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

// --- User-Zone Assignment Endpoints ---

// @route   GET /api/zones/:id/users
// @desc    Get all users assigned to a zone
// @access  Private (admin)
router.get('/:id/users', [passport.authenticate('jwt', { session: false }), checkRole('admin'), ...validateZoneId], async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT u.id, u.username, u.role FROM users u
             INNER JOIN user_zones uz ON u.id = uz.user_id
             WHERE uz.zone_id = $1`,
            [req.params.id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   POST /api/zones/:id/users
// @desc    Assign a user to a zone
// @access  Private (admin)
router.post('/:id/users', [passport.authenticate('jwt', { session: false }), checkRole('admin'), ...validateZoneId], async (req, res) => {
    const { userId } = req.body;
    const zoneId = req.params.id;

    if (!userId || !Number.isInteger(Number(userId))) {
        return res.status(400).json({ msg: 'Valid userId is required.' });
    }

    try {
        await pool.query(
            'INSERT INTO user_zones (user_id, zone_id) VALUES ($1, $2)',
            [userId, zoneId]
        );
        res.status(201).json({ msg: 'User assigned to zone successfully.' });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ msg: 'User is already assigned to this zone.' });
        }
        if (err.code === '23503') {
            return res.status(404).json({ msg: 'User or zone not found.' });
        }
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   DELETE /api/zones/:id/users/:userId
// @desc    Remove a user from a zone
// @access  Private (admin)
router.delete('/:id/users/:userId', [passport.authenticate('jwt', { session: false }), checkRole('admin'), ...validateZoneId], async (req, res) => {
    const { id, userId } = req.params;

    try {
        const result = await pool.query(
            'DELETE FROM user_zones WHERE zone_id = $1 AND user_id = $2',
            [id, userId]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ msg: 'Assignment not found.' });
        }
        res.json({ msg: 'User removed from zone successfully.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

module.exports = router;
