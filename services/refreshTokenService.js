/**
 * @file refreshTokenService.js
 * @description Refresh-token issuance, rotation, and reuse detection.
 *
 * Cookie value layout: `<tokenId>.<secret>`
 *   - tokenId: SHA-256(secret) truncated to 32 hex chars — the indexed lookup key
 *   - secret:  64 random bytes (hex)
 *
 * Stored in DB:
 *   - token_id   (lookup)
 *   - token_hash = HMAC-SHA256(secret, REFRESH_TOKEN_PEPPER)  (verification)
 *
 * Reuse detection: rotating a token tombstones it (sets revoked_at + replaced_by)
 * instead of deleting it. If a *revoked* token is later presented, we revoke the
 * entire family — the cookie was almost certainly stolen.
 *
 * Device binding: the SHA-256 of the User-Agent string and the /24 prefix of the
 * client IP are stored at issue. Mismatches on refresh revoke the family.
 */

const crypto = require('crypto');
const pool = require('../db/postgre');

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function getPepper() {
    const pepper = process.env.REFRESH_TOKEN_PEPPER || process.env.JWT_SECRET;
    if (!pepper) {
        throw new Error('REFRESH_TOKEN_PEPPER (or JWT_SECRET fallback) must be set.');
    }
    return pepper;
}

function deriveTokenId(secret) {
    return crypto.createHash('sha256').update(secret).digest('hex').slice(0, 32);
}

function hashSecret(secret) {
    return crypto.createHmac('sha256', getPepper()).update(secret).digest('hex');
}

function hashUserAgent(ua) {
    if (!ua) return null;
    return crypto.createHash('sha256').update(ua).digest('hex');
}

/**
 * Reduce an IP to a /24 prefix (IPv4) or /64 prefix (IPv6) so a roaming user
 * on the same network keeps working but a totally different network is rejected.
 */
function ipPrefix(ip) {
    if (!ip) return null;
    if (ip.includes(':')) {
        // IPv6 — keep first 4 hextets (/64)
        return ip.split(':').slice(0, 4).join(':');
    }
    const parts = ip.split('.');
    if (parts.length !== 4) return ip;
    return parts.slice(0, 3).join('.');
}

function newFamilyId() {
    return crypto.randomUUID();
}

function buildCookieValue(tokenId, secret) {
    return `${tokenId}.${secret}`;
}

function parseCookieValue(cookie) {
    if (typeof cookie !== 'string') return null;
    const dot = cookie.indexOf('.');
    if (dot < 1) return null;
    const tokenId = cookie.slice(0, dot);
    const secret = cookie.slice(dot + 1);
    if (!tokenId || !secret) return null;
    return { tokenId, secret };
}

function timingSafeEqualHex(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

/**
 * Issue a fresh refresh token. If `familyId` is omitted a new family is started.
 * Returns the cookie value and its expiry.
 */
async function issueToken({ userId, familyId, userAgent, ip }) {
    const secret = crypto.randomBytes(64).toString('hex');
    const tokenId = deriveTokenId(secret);
    const tokenHash = hashSecret(secret);
    const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
    const fid = familyId || newFamilyId();

    await pool.query(
        `INSERT INTO refresh_tokens
         (user_id, family_id, token_id, token_hash, user_agent_hash, ip_prefix, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, fid, tokenId, tokenHash, hashUserAgent(userAgent), ipPrefix(ip), expiresAt]
    );

    return {
        cookieValue: buildCookieValue(tokenId, secret),
        expiresAt,
        familyId: fid,
        tokenId,
    };
}

async function revokeFamily(familyId, reason = 'rotated') {
    await pool.query(
        `UPDATE refresh_tokens
         SET revoked_at = COALESCE(revoked_at, NOW())
         WHERE family_id = $1`,
        [familyId]
    );
    if (reason) {
        console.warn(`[refresh-tokens] revoked family ${familyId}: ${reason}`);
    }
}

/**
 * Rotate a presented refresh-token cookie. Returns:
 *   { ok: true, userId, cookieValue, expiresAt }                 on success
 *   { ok: false, status, reason }                                on failure
 *
 * On reuse / device-mismatch / expiry the entire family is revoked.
 */
async function rotate({ cookie, userAgent, ip }) {
    const parsed = parseCookieValue(cookie);
    if (!parsed) {
        return { ok: false, status: 401, reason: 'missing' };
    }

    const { tokenId, secret } = parsed;

    const result = await pool.query(
        'SELECT * FROM refresh_tokens WHERE token_id = $1',
        [tokenId]
    );
    const stored = result.rows[0];

    if (!stored) {
        return { ok: false, status: 403, reason: 'unknown' };
    }

    const expectedHash = hashSecret(secret);
    if (!timingSafeEqualHex(expectedHash, stored.token_hash)) {
        // Valid token_id but wrong secret — treat as compromise.
        await revokeFamily(stored.family_id, 'secret-mismatch');
        return { ok: false, status: 403, reason: 'tampered' };
    }

    if (stored.revoked_at) {
        // The hallmark of a stolen cookie: the legitimate user already rotated,
        // and now an old copy is being replayed. Burn the whole family.
        await revokeFamily(stored.family_id, 'reuse-detected');
        return { ok: false, status: 403, reason: 'reused' };
    }

    if (new Date(stored.expires_at) <= new Date()) {
        return { ok: false, status: 403, reason: 'expired' };
    }

    // Device binding checks
    if (stored.user_agent_hash && stored.user_agent_hash !== hashUserAgent(userAgent)) {
        await revokeFamily(stored.family_id, 'ua-mismatch');
        return { ok: false, status: 403, reason: 'device' };
    }
    if (stored.ip_prefix && stored.ip_prefix !== ipPrefix(ip)) {
        await revokeFamily(stored.family_id, 'ip-mismatch');
        return { ok: false, status: 403, reason: 'device' };
    }

    // Issue replacement under the same family
    const replacement = await issueToken({
        userId: stored.user_id,
        familyId: stored.family_id,
        userAgent,
        ip,
    });

    // Tombstone the presented token rather than deleting it — that's what makes
    // reuse detection possible.
    await pool.query(
        'UPDATE refresh_tokens SET revoked_at = NOW(), replaced_by = $1 WHERE id = $2',
        [replacement.tokenId, stored.id]
    );

    return {
        ok: true,
        userId: stored.user_id,
        cookieValue: replacement.cookieValue,
        expiresAt: replacement.expiresAt,
    };
}

async function revokeByCookie(cookie) {
    const parsed = parseCookieValue(cookie);
    if (!parsed) return;
    const result = await pool.query(
        'SELECT family_id FROM refresh_tokens WHERE token_id = $1',
        [parsed.tokenId]
    );
    if (result.rows[0]) {
        await revokeFamily(result.rows[0].family_id, 'logout');
    }
}

module.exports = {
    issueToken,
    rotate,
    revokeByCookie,
    revokeFamily,
    REFRESH_TTL_MS,
};
