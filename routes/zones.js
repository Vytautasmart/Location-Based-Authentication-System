const express = require('express');
const router = express.Router();
const pool = require('../db/postgre');
const passport = require('passport');
const { checkRole } = require('../middleware/rbac');
const { validateZoneDynamic, validateZoneId } = require('../middleware/validation');

// @route   GET /api/zones
// @desc    Get all authorized zones (with w3w squares attached)
// @access  Public
router.get('/', async (req, res) => {
    try {
        const zones = await pool.query('SELECT * FROM authorized_zones');

        // Attach squares to w3w zones
        const w3wZoneIds = zones.rows.filter(z => z.type === 'w3w').map(z => z.id);
        const squaresMap = {};
        if (w3wZoneIds.length > 0) {
            const squares = await pool.query(
                'SELECT * FROM w3w_zone_squares WHERE zone_id = ANY($1)',
                [w3wZoneIds]
            );
            for (const sq of squares.rows) {
                if (!squaresMap[sq.zone_id]) squaresMap[sq.zone_id] = [];
                squaresMap[sq.zone_id].push(sq);
            }
        }

        const result = zones.rows.map(z => ({
            ...z,
            squares: z.type === 'w3w' ? (squaresMap[z.id] || []) : undefined,
        }));
        res.json(result);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// --- what3words proxy endpoints (must be before /:id routes) ---

// @route   GET /api/zones/w3w/grid
// @desc    Get what3words grid lines for a bounding box
// @access  Private (admin)
router.get('/w3w/grid', [passport.authenticate('jwt', { session: false }), checkRole('admin')], (req, res) => {
    const { south, west, north, east } = req.query;
    try {
        const w3wService = require('../services/w3wService');
        const grid = w3wService.getGridSection({
            south: parseFloat(south),
            west: parseFloat(west),
            north: parseFloat(north),
            east: parseFloat(east),
        });
        res.json(grid);
    } catch (err) {
        console.error('W3W grid error:', err.message);
        res.status(500).json({ msg: 'Failed to fetch grid' });
    }
});

// @route   GET /api/zones/w3w/convert
// @desc    Convert lat/lng to what3words address
// @access  Private (admin)
router.get('/w3w/convert', [passport.authenticate('jwt', { session: false }), checkRole('admin')], (req, res) => {
    const { lat, lng } = req.query;
    try {
        const w3wService = require('../services/w3wService');
        const result = w3wService.coordsToWords(parseFloat(lat), parseFloat(lng));
        res.json({ words: result.words, square: result.square });
    } catch (err) {
        console.error('W3W convert error:', err.message);
        res.status(500).json({ msg: 'Failed to convert coordinates' });
    }
});

// @route   POST /api/zones
// @desc    Create a new authorized zone (circular or w3w)
// @access  Private (admin)
router.post('/', [passport.authenticate('jwt', { session: false }), checkRole('admin'), validateZoneDynamic], async (req, res) => {
    const { type = 'circular' } = req.body;

    try {
        if (type === 'w3w') {
            const { name, squares } = req.body;
            const centerLat = squares.reduce((s, sq) => s + sq.latitude, 0) / squares.length;
            const centerLng = squares.reduce((s, sq) => s + sq.longitude, 0) / squares.length;

            const newZone = await pool.query(
                `INSERT INTO authorized_zones (name, type, center_latitude, center_longitude)
                 VALUES ($1, 'w3w', $2, $3) RETURNING *`,
                [name, centerLat, centerLng]
            );
            const zoneId = newZone.rows[0].id;

            for (const sq of squares) {
                await pool.query(
                    'INSERT INTO w3w_zone_squares (zone_id, words, latitude, longitude) VALUES ($1, $2, $3, $4)',
                    [zoneId, sq.words, sq.latitude, sq.longitude]
                );
            }

            res.json({ ...newZone.rows[0], squares });
        } else {
            const { name, latitude, longitude, radius } = req.body;
            const newZone = await pool.query(
                'INSERT INTO authorized_zones (name, latitude, longitude, radius, type) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [name, latitude, longitude, radius, 'circular']
            );
            res.json(newZone.rows[0]);
        }
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   PUT /api/zones/:id
// @desc    Update an authorized zone
// @access  Private (admin)
router.put('/:id', [passport.authenticate('jwt', { session: false }), checkRole('admin'), ...validateZoneId, validateZoneDynamic], async (req, res) => {
    const { id } = req.params;
    const { type = 'circular' } = req.body;

    try {
        if (type === 'w3w') {
            const { name, squares } = req.body;
            const centerLat = squares.reduce((s, sq) => s + sq.latitude, 0) / squares.length;
            const centerLng = squares.reduce((s, sq) => s + sq.longitude, 0) / squares.length;

            const updatedZone = await pool.query(
                `UPDATE authorized_zones SET name = $1, type = 'w3w', center_latitude = $2, center_longitude = $3,
                 latitude = NULL, longitude = NULL, radius = NULL WHERE id = $4 RETURNING *`,
                [name, centerLat, centerLng, id]
            );

            await pool.query('DELETE FROM w3w_zone_squares WHERE zone_id = $1', [id]);
            for (const sq of squares) {
                await pool.query(
                    'INSERT INTO w3w_zone_squares (zone_id, words, latitude, longitude) VALUES ($1, $2, $3, $4)',
                    [id, sq.words, sq.latitude, sq.longitude]
                );
            }

            res.json({ ...updatedZone.rows[0], squares });
        } else {
            const { name, latitude, longitude, radius } = req.body;
            const updatedZone = await pool.query(
                'UPDATE authorized_zones SET name = $1, latitude = $2, longitude = $3, radius = $4 WHERE id = $5 RETURNING *',
                [name, latitude, longitude, radius, id]
            );
            res.json(updatedZone.rows[0]);
        }
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
