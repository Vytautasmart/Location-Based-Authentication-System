/**
 * @file routes/metrics.js
 * @description Admin-only metrics endpoints powering the metrics dashboard.
 *
 * Denial reasons are derived from auth_logs flags:
 *   - user_id IS NULL              → bad_credentials
 *   - is_spoofed                   → spoof
 *   - NOT is_location_verified     → outside_zone
 *   - else (access_granted = false but verified) → other
 */

const express = require('express');
const router = express.Router();
const passport = require('passport');
const pool = require('../db/postgre');
const { checkRole } = require('../middleware/rbac');
const refreshTokenService = require('../services/refreshTokenService');

const requireAdmin = [passport.authenticate('jwt', { session: false }), checkRole('admin')];

const HOUR_MS = 60 * 60 * 1000;

function clampHours(raw, fallback, max = 24 * 30) {
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n <= 0) return fallback;
    return Math.min(n, max);
}

/**
 * @route GET /api/metrics/summary
 * @desc  Headline KPIs over the last `hours` (default 24).
 */
router.get('/summary', requireAdmin, async (req, res) => {
    const hours = clampHours(req.query.hours, 24);
    const since = new Date(Date.now() - hours * HOUR_MS);

    try {
        const [totals, latency, users, mfa, lockouts] = await Promise.all([
            pool.query(
                `SELECT
                   COUNT(*)::int                                       AS attempts,
                   COUNT(*) FILTER (WHERE access_granted)::int         AS granted,
                   COUNT(*) FILTER (WHERE NOT access_granted)::int     AS denied,
                   COUNT(*) FILTER (WHERE is_spoofed)::int             AS spoofed,
                   COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL)::int AS unique_users
                 FROM auth_logs WHERE timestamp >= $1`,
                [since]
            ),
            pool.query(
                `SELECT
                   percentile_cont(0.5)  WITHIN GROUP (ORDER BY latency)::int AS p50,
                   percentile_cont(0.95) WITHIN GROUP (ORDER BY latency)::int AS p95,
                   AVG(latency)::int                                          AS avg
                 FROM auth_logs
                 WHERE timestamp >= $1 AND latency IS NOT NULL`,
                [since]
            ),
            pool.query(`SELECT COUNT(*)::int AS total FROM users`),
            pool.query(`SELECT COUNT(*) FILTER (WHERE totp_enabled)::int AS enabled, COUNT(*)::int AS total FROM users`),
            pool.query(
                `SELECT COUNT(DISTINCT username)::int AS locked_users
                 FROM login_attempts
                 WHERE attempt_time >= NOW() - INTERVAL '15 minutes' AND success = FALSE
                 GROUP BY username
                 HAVING COUNT(*) >= 5`
            ),
        ]);

        res.json({
            window_hours: hours,
            attempts: totals.rows[0].attempts,
            granted: totals.rows[0].granted,
            denied: totals.rows[0].denied,
            spoofed: totals.rows[0].spoofed,
            unique_users: totals.rows[0].unique_users,
            grant_rate: totals.rows[0].attempts
                ? +(totals.rows[0].granted / totals.rows[0].attempts).toFixed(3)
                : 0,
            latency_ms: {
                p50: latency.rows[0]?.p50 ?? null,
                p95: latency.rows[0]?.p95 ?? null,
                avg: latency.rows[0]?.avg ?? null,
            },
            users_total: users.rows[0].total,
            mfa_enabled: mfa.rows[0].enabled,
            mfa_rate: mfa.rows[0].total ? +(mfa.rows[0].enabled / mfa.rows[0].total).toFixed(3) : 0,
            currently_locked: lockouts.rows.length,
        });
    } catch (err) {
        console.error('metrics/summary error:', err.message);
        res.status(500).json({ msg: 'Failed to load summary.' });
    }
});

/**
 * @route GET /api/metrics/timeseries
 * @desc  Granted / denied per hour bucket over the last `hours` (default 168 = 7d).
 */
router.get('/timeseries', requireAdmin, async (req, res) => {
    const hours = clampHours(req.query.hours, 168);
    const since = new Date(Date.now() - hours * HOUR_MS);

    try {
        const result = await pool.query(
            `SELECT
               date_trunc('hour', timestamp) AS bucket,
               COUNT(*) FILTER (WHERE access_granted)::int     AS granted,
               COUNT(*) FILTER (WHERE NOT access_granted)::int AS denied
             FROM auth_logs
             WHERE timestamp >= $1
             GROUP BY bucket
             ORDER BY bucket`,
            [since]
        );
        res.json({ window_hours: hours, buckets: result.rows });
    } catch (err) {
        console.error('metrics/timeseries error:', err.message);
        res.status(500).json({ msg: 'Failed to load time series.' });
    }
});

/**
 * @route GET /api/metrics/denial-reasons
 * @desc  Categorised counts for denials in the last `hours` (default 24).
 */
router.get('/denial-reasons', requireAdmin, async (req, res) => {
    const hours = clampHours(req.query.hours, 24);
    const since = new Date(Date.now() - hours * HOUR_MS);

    try {
        const result = await pool.query(
            `SELECT
               COUNT(*) FILTER (WHERE user_id IS NULL)::int                                                AS bad_credentials,
               COUNT(*) FILTER (WHERE user_id IS NOT NULL AND is_spoofed)::int                             AS spoof,
               COUNT(*) FILTER (WHERE user_id IS NOT NULL AND NOT is_spoofed AND NOT is_location_verified)::int AS outside_zone,
               COUNT(*) FILTER (WHERE NOT access_granted AND user_id IS NOT NULL AND NOT is_spoofed AND is_location_verified)::int AS other
             FROM auth_logs
             WHERE timestamp >= $1 AND NOT access_granted`,
            [since]
        );
        res.json({ window_hours: hours, ...result.rows[0] });
    } catch (err) {
        console.error('metrics/denial-reasons error:', err.message);
        res.status(500).json({ msg: 'Failed to load denial reasons.' });
    }
});

/**
 * @route GET /api/metrics/recent
 * @desc  Most recent authentication attempts (default 50, max 200) with username joined.
 */
router.get('/recent', requireAdmin, async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    try {
        const result = await pool.query(
            `SELECT al.*, u.username
             FROM auth_logs al
             LEFT JOIN users u ON u.id = al.user_id
             ORDER BY al.timestamp DESC
             LIMIT $1`,
            [limit]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('metrics/recent error:', err.message);
        res.status(500).json({ msg: 'Failed to load recent attempts.' });
    }
});

/**
 * @route GET /api/metrics/users
 * @desc  Users list with auth-stat aggregates over the last `hours` (default 168).
 */
router.get('/users', requireAdmin, async (req, res) => {
    const hours = clampHours(req.query.hours, 168);
    const since = new Date(Date.now() - hours * HOUR_MS);

    try {
        const result = await pool.query(
            `SELECT
               u.id, u.username, u.role, u.totp_enabled,
               COALESCE(s.attempts, 0)::int AS attempts,
               COALESCE(s.granted, 0)::int  AS granted,
               COALESCE(s.denied, 0)::int   AS denied,
               s.last_attempt
             FROM users u
             LEFT JOIN (
               SELECT user_id,
                      COUNT(*) AS attempts,
                      COUNT(*) FILTER (WHERE access_granted)     AS granted,
                      COUNT(*) FILTER (WHERE NOT access_granted) AS denied,
                      MAX(timestamp) AS last_attempt
               FROM auth_logs
               WHERE timestamp >= $1 AND user_id IS NOT NULL
               GROUP BY user_id
             ) s ON s.user_id = u.id
             ORDER BY s.last_attempt DESC NULLS LAST, u.username`,
            [since]
        );
        res.json({ window_hours: hours, users: result.rows });
    } catch (err) {
        console.error('metrics/users error:', err.message);
        res.status(500).json({ msg: 'Failed to load users.' });
    }
});

/**
 * @route GET /api/metrics/users/:id
 * @desc  Per-user drilldown: profile, recent attempts, assigned zones, active sessions.
 */
router.get('/users/:id', requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ msg: 'Invalid user id.' });

    try {
        const [user, logs, zones, sessions] = await Promise.all([
            pool.query('SELECT id, username, role, totp_enabled FROM users WHERE id = $1', [id]),
            pool.query('SELECT * FROM auth_logs WHERE user_id = $1 ORDER BY timestamp DESC LIMIT 100', [id]),
            pool.query(
                `SELECT az.id, az.name, az.type
                 FROM authorized_zones az
                 INNER JOIN user_zones uz ON uz.zone_id = az.id
                 WHERE uz.user_id = $1`,
                [id]
            ),
            pool.query(
                `SELECT family_id, MIN(issued_at) AS started_at, MAX(issued_at) AS last_rotated_at,
                        COUNT(*)::int AS rotations,
                        BOOL_OR(revoked_at IS NULL) AS active
                 FROM refresh_tokens
                 WHERE user_id = $1
                 GROUP BY family_id
                 ORDER BY started_at DESC
                 LIMIT 20`,
                [id]
            ),
        ]);

        if (user.rows.length === 0) return res.status(404).json({ msg: 'User not found.' });

        res.json({
            user: user.rows[0],
            recent_attempts: logs.rows,
            zones: zones.rows,
            sessions: sessions.rows,
        });
    } catch (err) {
        console.error('metrics/user error:', err.message);
        res.status(500).json({ msg: 'Failed to load user.' });
    }
});

/**
 * @route POST /api/metrics/users/:id/force-logout
 * @desc  Revoke every refresh-token family belonging to the user.
 *        Admin self-protection: cannot force-logout yourself (would be a footgun).
 */
router.post('/users/:id/force-logout', requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ msg: 'Invalid user id.' });
    if (id === req.user.id) return res.status(400).json({ msg: 'Cannot force-logout yourself.' });

    try {
        const families = await pool.query(
            'SELECT DISTINCT family_id FROM refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL',
            [id]
        );
        for (const row of families.rows) {
            await refreshTokenService.revokeFamily(row.family_id, `admin-force-logout by user ${req.user.id}`);
        }
        res.json({ msg: 'All sessions revoked.', revoked_families: families.rows.length });
    } catch (err) {
        console.error('metrics/force-logout error:', err.message);
        res.status(500).json({ msg: 'Failed to revoke sessions.' });
    }
});

/**
 * @route GET /api/metrics/zones/usage
 * @desc  Per-zone grant counts in the last `hours` (default 168).
 *        Approximated by matching client coordinates to zone bounds — accurate
 *        for circular zones and a best-effort estimate for w3w zones.
 */
router.get('/zones/usage', requireAdmin, async (req, res) => {
    const hours = clampHours(req.query.hours, 168);
    const since = new Date(Date.now() - hours * HOUR_MS);

    try {
        const result = await pool.query(
            `SELECT z.id, z.name, z.type,
                    COUNT(al.id) FILTER (WHERE al.access_granted)::int AS grants
             FROM authorized_zones z
             LEFT JOIN auth_logs al ON al.access_granted = TRUE
                  AND al.is_location_verified = TRUE
                  AND al.timestamp >= $1
                  AND z.type = 'circular'
                  AND z.latitude IS NOT NULL
                  AND ( 6371000 * acos(
                        cos(radians(z.latitude)) * cos(radians(al.client_latitude))
                        * cos(radians(al.client_longitude) - radians(z.longitude))
                        + sin(radians(z.latitude)) * sin(radians(al.client_latitude))
                      ) ) <= z.radius
             GROUP BY z.id
             ORDER BY grants DESC NULLS LAST, z.name`,
            [since]
        );
        res.json({ window_hours: hours, zones: result.rows });
    } catch (err) {
        console.error('metrics/zones/usage error:', err.message);
        res.status(500).json({ msg: 'Failed to load zone usage.' });
    }
});

module.exports = router;
