const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const pool = require('../db/postgre');

const locationService = require('../services/locationService');
const authorizationService = require('../services/authorizationService');
const refreshTokenService = require('../services/refreshTokenService');
const totpService = require('../services/totpService');
const passport = require('passport');
const { validateLogin, validateAccess } = require('../middleware/validation');

const JWT_OPTIONS = { algorithm: 'HS256', expiresIn: '15m' };

function clientIp(req) {
    // trust proxy is set to 1 in app.js, so req.ip is the real client.
    return req.ip;
}

function refreshCookieOptions(expires) {
    return {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        path: '/api/auth',
        expires,
    };
}

/**
 * @route   POST /api/auth/login
 * @desc    Credential-only login. Returns a JWT.
 *          If TOTP is enabled, requires a valid `totpCode`.
 * @access  Public
 */
router.post('/login', validateLogin, passport.authenticate('local', { session: false }), async (req, res, next) => {
    try {
        const totp = await totpService.getUserTotp(req.user.id);
        if (totp?.enabled) {
            const code = req.body.totpCode;
            if (!code) {
                return res.status(401).json({ msg: 'TOTP code required.', mfa: 'required' });
            }
            if (!totpService.verifyCode(totp.secret, code)) {
                return res.status(401).json({ msg: 'Invalid TOTP code.' });
            }
        }

        const payload = { user: { id: req.user.id, role: req.user.role } };
        const token = jwt.sign(payload, process.env.JWT_SECRET, JWT_OPTIONS);
        res.json({ token });
    } catch (err) {
        next(err);
    }
});

/**
 * @route   POST /api/auth/access
 * @desc    Login + GPS verification + IP-spoof check. Issues JWT + refresh cookie.
 * @access  Public
 */
router.post('/access', validateAccess, (req, res, next) => {
    const startTime = Date.now();
    const { latitude, longitude, totpCode } = req.body;
    const ip = clientIp(req);
    const userAgent = req.get('user-agent');

    passport.authenticate('local', { session: false }, async (err, user, info) => {
        if (err) return next(err);

        if (!user) {
            try {
                const latency = Date.now() - startTime;
                await pool.query(
                    `INSERT INTO auth_logs(user_id, client_latitude, client_longitude, ip_address, is_location_verified, is_spoofed, access_granted, latency)
                     VALUES(NULL, $1, $2, $3, FALSE, FALSE, FALSE, $4)`,
                    [latitude, longitude, ip, latency]
                );
            } catch (logErr) {
                console.error('Failed to log auth attempt:', logErr.message);
            }
            return res.status(401).json({ msg: info.message || 'Invalid credentials' });
        }

        // ---- TOTP gate ------------------------------------------------------
        try {
            const totp = await totpService.getUserTotp(user.id);
            if (totp?.enabled) {
                if (!totpCode) {
                    return res.status(401).json({ msg: 'TOTP code required.', mfa: 'required' });
                }
                if (!totpService.verifyCode(totp.secret, totpCode)) {
                    return res.status(401).json({ msg: 'Invalid TOTP code.' });
                }
            }
        } catch (totpErr) {
            console.error('TOTP check error:', totpErr.message);
            return res.status(500).send('Server error during MFA verification.');
        }

        let isLocationVerified = false;
        let spoofingCheckResult = { isSpoofed: false };
        let authorizationResult = { access: 'denied' };

        try {
            if (user.role !== 'admin') {
                spoofingCheckResult = await locationService.isLocationSpoofed(ip, latitude, longitude);
            }

            if (!spoofingCheckResult.isSpoofed) {
                const { isVerified, zoneName } = await locationService.verifyLocation({ latitude, longitude }, user.id);
                isLocationVerified = isVerified;
                authorizationResult = await authorizationService.grantAccess(user, isLocationVerified);
                if (authorizationResult.access === 'granted') {
                    authorizationResult.zoneName = zoneName;
                }
            }

            const latency = Date.now() - startTime;
            await pool.query(
                `INSERT INTO auth_logs(user_id, client_latitude, client_longitude, ip_address, ip_latitude, ip_longitude, is_location_verified, is_spoofed, access_granted, latency)
                 VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [
                    user.id, latitude, longitude, ip, spoofingCheckResult.ipLatitude,
                    spoofingCheckResult.ipLongitude, isLocationVerified,
                    spoofingCheckResult.isSpoofed, authorizationResult.access === 'granted', latency
                ]
            );

            if (authorizationResult.access === 'granted') {
                const payload = { user: { id: user.id, role: user.role } };
                const accessToken = jwt.sign(payload, process.env.JWT_SECRET, JWT_OPTIONS);

                const issued = await refreshTokenService.issueToken({
                    userId: user.id,
                    userAgent,
                    ip,
                });
                res.cookie('refreshToken', issued.cookieValue, refreshCookieOptions(issued.expiresAt));

                const authLogsRes = await pool.query(
                    'SELECT * FROM auth_logs WHERE user_id = $1 ORDER BY timestamp DESC',
                    [user.id]
                );

                return res.json({
                    ...authorizationResult,
                    token: accessToken,
                    authLogs: authLogsRes.rows,
                });
            }

            if (spoofingCheckResult.isSpoofed) {
                let msg = 'Access denied due to potential location spoofing.';
                if (spoofingCheckResult.reason === 'proxy') msg = 'Access from a VPN or proxy is not allowed.';
                else if (spoofingCheckResult.reason === 'country_mismatch') msg = 'Your reported location does not match your network country.';
                else if (spoofingCheckResult.reason === 'distance') msg = 'Your reported location is too far from your network location.';
                return res.status(403).json({ msg });
            }
            if (!isLocationVerified) {
                return res.status(403).json({ msg: 'Access denied. You are not in an authorized location.' });
            }
            return res.status(400).json({ msg: 'Authorization failed after location check.' });
        } catch (error) {
            console.error('Access error:', error.message);
            return res.status(500).send('Server error during location verification.');
        }
    })(req, res, next);
});

/**
 * @route   POST /api/auth/refresh
 * @desc    Rotate refresh token (with reuse detection + device binding).
 * @access  Public (requires a valid refresh token cookie)
 */
router.post('/refresh', async (req, res) => {
    try {
        const result = await refreshTokenService.rotate({
            cookie: req.cookies.refreshToken,
            userAgent: req.get('user-agent'),
            ip: clientIp(req),
        });

        if (!result.ok) {
            res.clearCookie('refreshToken', { path: '/api/auth' });
            const status = result.status || 401;
            const messages = {
                missing: 'No refresh token provided.',
                unknown: 'Invalid refresh token.',
                tampered: 'Invalid refresh token.',
                reused: 'Session revoked due to suspected token reuse. Please log in again.',
                expired: 'Refresh token has expired.',
                device: 'Session revoked: device or network changed. Please log in again.',
            };
            return res.status(status).json({ msg: messages[result.reason] || 'Refresh failed.' });
        }

        const userResult = await pool.query('SELECT id, role FROM users WHERE id = $1', [result.userId]);
        if (userResult.rows.length === 0) {
            res.clearCookie('refreshToken', { path: '/api/auth' });
            return res.status(403).json({ msg: 'User not found.' });
        }
        const user = userResult.rows[0];

        const payload = { user: { id: user.id, role: user.role } };
        const newAccessToken = jwt.sign(payload, process.env.JWT_SECRET, JWT_OPTIONS);

        res.cookie('refreshToken', result.cookieValue, refreshCookieOptions(result.expiresAt));
        res.json({ token: newAccessToken });
    } catch (err) {
        console.error('Refresh error:', err.message);
        res.status(500).send('Server error');
    }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Revoke the current refresh-token family.
 * @access  Public (requires a valid refresh token cookie)
 */
router.post('/logout', async (req, res) => {
    try {
        await refreshTokenService.revokeByCookie(req.cookies.refreshToken);
    } catch (err) {
        console.error('Logout error:', err.message);
    }
    res.clearCookie('refreshToken', { path: '/api/auth' });
    res.status(200).json({ msg: 'Logged out successfully.' });
});

// =========================================================================
// MFA enrollment endpoints
// =========================================================================

/**
 * @route   POST /api/auth/mfa/setup
 * @desc    Begin TOTP enrollment. Returns secret + otpauth URI for QR display.
 * @access  JWT
 */
router.post('/mfa/setup', passport.authenticate('jwt', { session: false }), async (req, res, next) => {
    try {
        const userResult = await pool.query('SELECT username, totp_enabled FROM users WHERE id = $1', [req.user.id]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ msg: 'User not found.' });
        }
        if (userResult.rows[0].totp_enabled) {
            return res.status(409).json({ msg: 'MFA is already enabled. Disable it before re-enrolling.' });
        }

        const secret = totpService.generateSecret();
        await totpService.setPendingSecret(req.user.id, secret);
        const otpauth = totpService.buildOtpauthUri(userResult.rows[0].username, secret);

        res.json({ secret, otpauth });
    } catch (err) {
        next(err);
    }
});

/**
 * @route   POST /api/auth/mfa/verify
 * @desc    Confirm TOTP enrollment by submitting a code from the authenticator app.
 * @access  JWT
 */
router.post('/mfa/verify', passport.authenticate('jwt', { session: false }), async (req, res, next) => {
    try {
        const { code } = req.body;
        const totp = await totpService.getUserTotp(req.user.id);
        if (!totp?.secret) {
            return res.status(400).json({ msg: 'No pending MFA enrollment. Call /mfa/setup first.' });
        }
        if (!totpService.verifyCode(totp.secret, code)) {
            return res.status(401).json({ msg: 'Invalid TOTP code.' });
        }
        await totpService.enable(req.user.id);
        res.json({ msg: 'MFA enabled.' });
    } catch (err) {
        next(err);
    }
});

/**
 * @route   POST /api/auth/mfa/disable
 * @desc    Disable TOTP. Requires a current valid code so a stolen JWT alone can't disable MFA.
 * @access  JWT
 */
router.post('/mfa/disable', passport.authenticate('jwt', { session: false }), async (req, res, next) => {
    try {
        const { code } = req.body;
        const totp = await totpService.getUserTotp(req.user.id);
        if (!totp?.enabled) {
            return res.status(400).json({ msg: 'MFA is not enabled.' });
        }
        if (!totpService.verifyCode(totp.secret, code)) {
            return res.status(401).json({ msg: 'Invalid TOTP code.' });
        }
        await totpService.disable(req.user.id);
        res.json({ msg: 'MFA disabled.' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
