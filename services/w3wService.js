/**
 * @file w3wService.js
 * @description Self-computed 3m x 3m microgrid system for precise location zones.
 * Replaces the what3words API with local math — no external API calls needed.
 *
 * Each grid cell is ~3m x 3m and gets a deterministic identifier based on its
 * row/column in a global grid aligned to latitude/longitude.
 */

// One degree of latitude is ~111,320 meters everywhere on Earth.
const METERS_PER_DEG_LAT = 111320;
const CELL_SIZE = 3; // meters
const LAT_STEP = CELL_SIZE / METERS_PER_DEG_LAT; // ~0.00002694 degrees

/**
 * Compute the longitude step for a given latitude row.
 * Longitude degrees shrink toward the poles: 1 deg ≈ 111320 * cos(lat) meters.
 */
function lngStepAtRow(rowBaseLat) {
  const cosLat = Math.cos(rowBaseLat * Math.PI / 180);
  if (cosLat < 0.0001) return LAT_STEP; // near poles, fall back
  return CELL_SIZE / (METERS_PER_DEG_LAT * cosLat);
}

/**
 * Convert GPS coordinates to a grid cell identifier and its bounds.
 * @param {number} lat
 * @param {number} lng
 * @returns {{words: string, square: {southwest: {lat, lng}, northeast: {lat, lng}}}}
 */
function coordsToWords(lat, lng) {
  const row = Math.floor(lat / LAT_STEP);
  const rowBaseLat = row * LAT_STEP;
  const lngStep = lngStepAtRow(rowBaseLat);
  const col = Math.floor(lng / lngStep);

  const south = row * LAT_STEP;
  const north = (row + 1) * LAT_STEP;
  const west = col * lngStep;
  const east = (col + 1) * lngStep;

  return {
    words: `${row}.${col}`,
    square: {
      southwest: { lat: south, lng: west },
      northeast: { lat: north, lng: east },
    },
  };
}

/**
 * Convert a grid cell identifier back to its center coordinates.
 * @param {string} words - Grid cell ID in "row.col" format
 * @returns {{lat: number, lng: number, square: object}}
 */
function wordsToCoords(words) {
  const [row, col] = words.split('.').map(Number);
  const south = row * LAT_STEP;
  const north = (row + 1) * LAT_STEP;
  const rowBaseLat = south;
  const lngStep = lngStepAtRow(rowBaseLat);
  const west = col * lngStep;
  const east = (col + 1) * lngStep;

  return {
    lat: (south + north) / 2,
    lng: (west + east) / 2,
    square: {
      southwest: { lat: south, lng: west },
      northeast: { lat: north, lng: east },
    },
  };
}

/**
 * Generate GeoJSON grid lines for a bounding box.
 * @param {object} bounds - { south, west, north, east }
 * @returns {object} GeoJSON FeatureCollection of grid lines
 */
function getGridSection(bounds) {
  const { south, west, north, east } = bounds;
  const features = [];

  // Compute row range
  const rowStart = Math.floor(south / LAT_STEP);
  const rowEnd = Math.ceil(north / LAT_STEP);

  // Use center latitude to compute a uniform column step for this viewport
  const centerLat = (south + north) / 2;
  const lngStep = lngStepAtRow(centerLat);
  const colStart = Math.floor(west / lngStep);
  const colEnd = Math.ceil(east / lngStep);

  // Safety: limit total lines to avoid freezing the browser
  const maxLines = 2000;
  const totalH = rowEnd - rowStart + 1;
  const totalV = colEnd - colStart + 1;
  if (totalH + totalV > maxLines) {
    return { type: 'FeatureCollection', features: [] };
  }

  // Horizontal lines (constant latitude)
  for (let r = rowStart; r <= rowEnd; r++) {
    const lat = r * LAT_STEP;
    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [[west, lat], [east, lat]],
      },
      properties: {},
    });
  }

  // Vertical lines (constant longitude)
  for (let c = colStart; c <= colEnd; c++) {
    const lng = c * lngStep;
    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [[lng, south], [lng, north]],
      },
      properties: {},
    });
  }

  return { type: 'FeatureCollection', features };
}

module.exports = { coordsToWords, wordsToCoords, getGridSection };
