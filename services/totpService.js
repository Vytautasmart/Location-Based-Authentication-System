/**
 * @file totpService.js
 * @description TOTP (RFC 6238) MFA helpers — generation, verification, otpauth URI.
 *
 * Uses the `otplib` package. Secrets are stored base32-encoded in users.totp_secret.
 * Once `users.totp_enabled = TRUE`, the user must supply a 6-digit code on /access.
 */

const { authenticator } = require('otplib');
const pool = require('../db/postgre');

// 1-step window (±30s) tolerates clock drift without weakening security too much.
authenticator.options = { window: 1, step: 30, digits: 6 };

const ISSUER = 'LBAS';

function generateSecret() {
    return authenticator.generateSecret();
}

function buildOtpauthUri(username, secret) {
    return authenticator.keyuri(username, ISSUER, secret);
}

function verifyCode(secret, code) {
    if (!secret || !code) return false;
    if (!/^\d{6}$/.test(String(code))) return false;
    try {
        return authenticator.verify({ token: String(code), secret });
    } catch {
        return false;
    }
}

/**
 * Returns { enabled, secret } for a user, or null if user not found.
 * `secret` is only included when MFA is enrolled.
 */
async function getUserTotp(userId) {
    const r = await pool.query(
        'SELECT totp_secret, totp_enabled FROM users WHERE id = $1',
        [userId]
    );
    if (r.rows.length === 0) return null;
    return { enabled: r.rows[0].totp_enabled, secret: r.rows[0].totp_secret };
}

async function setPendingSecret(userId, secret) {
    await pool.query(
        'UPDATE users SET totp_secret = $1, totp_enabled = FALSE WHERE id = $2',
        [secret, userId]
    );
}

async function enable(userId) {
    await pool.query(
        'UPDATE users SET totp_enabled = TRUE WHERE id = $1',
        [userId]
    );
}

async function disable(userId) {
    await pool.query(
        'UPDATE users SET totp_secret = NULL, totp_enabled = FALSE WHERE id = $1',
        [userId]
    );
}

module.exports = {
    generateSecret,
    buildOtpauthUri,
    verifyCode,
    getUserTotp,
    setPendingSecret,
    enable,
    disable,
};
