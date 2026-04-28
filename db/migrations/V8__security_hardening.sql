-- Security hardening: TOTP MFA, refresh-token redesign with reuse detection + device binding.

-- =========================================================================
-- 1. TOTP MFA on users
-- =========================================================================
ALTER TABLE users ADD COLUMN totp_secret VARCHAR(64);
ALTER TABLE users ADD COLUMN totp_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- =========================================================================
-- 2. Refresh-token redesign
--
-- The old schema stored a bcrypt(random_hex) value, which forced an O(n)
-- scan + bcrypt.compare on every refresh/logout. The new design:
--
--   - token_id: short, indexed lookup key (SHA-256 of the random secret,
--     first 32 hex chars). Unique.
--   - token_hash: HMAC-SHA256(secret, server pepper) for verification.
--   - The cookie value sent to the client is `tokenId.secret`.
--   - family_id: groups all tokens issued in a single login session, so a
--     reuse-detection event can revoke the entire family.
--   - revoked_at: instead of deleting on rotation we tombstone, so we can
--     detect re-use of an already-rotated token.
--   - user_agent_hash + ip_prefix: device binding. Mismatches revoke the
--     family.
-- =========================================================================
DROP TABLE IF EXISTS refresh_tokens;

CREATE TABLE refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    family_id UUID NOT NULL,
    token_id VARCHAR(64) NOT NULL UNIQUE,
    token_hash VARCHAR(128) NOT NULL,
    user_agent_hash VARCHAR(64),
    ip_prefix VARCHAR(64),
    issued_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP,
    replaced_by VARCHAR(64)
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_family_id ON refresh_tokens(family_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
