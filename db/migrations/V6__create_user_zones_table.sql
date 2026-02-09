CREATE TABLE user_zones (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    zone_id INTEGER NOT NULL REFERENCES authorized_zones(id) ON DELETE CASCADE,
    UNIQUE(user_id, zone_id)
);

CREATE INDEX idx_user_zones_user_id ON user_zones(user_id);
CREATE INDEX idx_user_zones_zone_id ON user_zones(zone_id);
