-- Add zone type column (circular = existing, w3w = what3words)
ALTER TABLE authorized_zones ADD COLUMN type VARCHAR(10) NOT NULL DEFAULT 'circular';

-- Make lat/lng/radius nullable since w3w zones don't use them
ALTER TABLE authorized_zones ALTER COLUMN latitude DROP NOT NULL;
ALTER TABLE authorized_zones ALTER COLUMN longitude DROP NOT NULL;
ALTER TABLE authorized_zones ALTER COLUMN radius DROP NOT NULL;

-- Center point for w3w zones (computed from square averages, for map display)
ALTER TABLE authorized_zones ADD COLUMN center_latitude REAL;
ALTER TABLE authorized_zones ADD COLUMN center_longitude REAL;

-- Each row is one 3m x 3m what3words square belonging to a zone
CREATE TABLE w3w_zone_squares (
    id SERIAL PRIMARY KEY,
    zone_id INTEGER NOT NULL REFERENCES authorized_zones(id) ON DELETE CASCADE,
    words VARCHAR(100) NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    UNIQUE(zone_id, words)
);

CREATE INDEX idx_w3w_zone_squares_zone_id ON w3w_zone_squares(zone_id);
CREATE INDEX idx_w3w_zone_squares_words ON w3w_zone_squares(words);
