-- Database initialization script
-- Combines all migrations (V0-V6) for Docker setup

-- V0: Create users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL
);

-- V1: Create authorized zones table
CREATE TABLE authorized_zones (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    radius REAL NOT NULL
);

-- V2: Add role column to users
ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'user';

-- V3: Create auth logs table
CREATE TABLE auth_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    client_latitude REAL,
    client_longitude REAL,
    ip_address VARCHAR(50),
    ip_latitude REAL,
    ip_longitude REAL,
    is_location_verified BOOLEAN,
    is_spoofed BOOLEAN,
    access_granted BOOLEAN,
    latency INTEGER
);

-- V4: Create refresh tokens table
CREATE TABLE refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);

-- V5: Create login attempts table
CREATE TABLE login_attempts (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    attempt_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    success BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_login_attempts_username ON login_attempts(username);
CREATE INDEX idx_login_attempts_time ON login_attempts(attempt_time);

-- V6: Create user-zone associations table
CREATE TABLE user_zones (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    zone_id INTEGER NOT NULL REFERENCES authorized_zones(id) ON DELETE CASCADE,
    UNIQUE(user_id, zone_id)
);

CREATE INDEX idx_user_zones_user_id ON user_zones(user_id);
CREATE INDEX idx_user_zones_zone_id ON user_zones(zone_id);
