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
