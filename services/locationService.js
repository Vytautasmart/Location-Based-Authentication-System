/**
 * @file locationService.js
 * @description This service will be responsible for verifying the user's location.
 * In a real implementation, this would involve checking coordinates against geofenced zones.
 */

const pool = require("../db/postgre");

// Fallback distance threshold for spoofing detection (500km)
// Used only when country-level comparison is unavailable
const SPOOFING_DISTANCE_THRESHOLD = 500000;

/**
 * Calculates the distance between two points on Earth using the Haversine formula.
 * @param {number} lat1 - Latitude of the first point.
 * @param {number} lon1 - Longitude of the first point.
 * @param {number} lat2 - Latitude of the second point.
 * @param {number} lon2 - Longitude of the second point.
 * @returns {number} The distance in meters.
 */
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // metres
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dp / 2) * Math.sin(dp / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const d = R * c; // in metres
  return d;
}

/**
 * Verifies if a user's location is within an authorized zone.
 * If a userId is provided, only checks zones assigned to that user.
 * Falls back to all zones if no specific zones are assigned.
 *
 * @param {object} locationData - The location data from the client (e.g., { latitude, longitude }).
 * @param {number} [userId] - Optional user ID to check user-specific zone assignments.
 * @returns {Promise<object>} - A promise that resolves to { isVerified, zoneName }.
 */
const verifyLocation = async (locationData, userId) => {
  if (!locationData || !locationData.latitude || !locationData.longitude) {
    return { isVerified: false, zoneName: null };
  }

  try {
    const { latitude, longitude } = locationData;
    let authorizedZones;

    // If userId provided, check for user-specific zone assignments first
    if (userId) {
      const userZonesResult = await pool.query(
        `SELECT az.* FROM authorized_zones az
         INNER JOIN user_zones uz ON az.id = uz.zone_id
         WHERE uz.user_id = $1`,
        [userId]
      );

      // If user has assigned zones, only check those
      if (userZonesResult.rows.length > 0) {
        authorizedZones = userZonesResult.rows;
      }
    }

    // Fall back to all zones if no user-specific assignments
    if (!authorizedZones) {
      const result = await pool.query("SELECT * FROM authorized_zones");
      authorizedZones = result.rows;
    }

    // Check microgrid zones first (3m precision, more accurate than radius)
    const w3wZones = authorizedZones.filter(z => z.type === 'w3w');
    if (w3wZones.length > 0) {
      const w3wService = require('./w3wService');
      const { words: userWords } = w3wService.coordsToWords(latitude, longitude);

      const w3wZoneIds = w3wZones.map(z => z.id);
      const matchResult = await pool.query(
        'SELECT zone_id FROM w3w_zone_squares WHERE zone_id = ANY($1) AND words = $2 LIMIT 1',
        [w3wZoneIds, userWords]
      );

      if (matchResult.rows.length > 0) {
        const matchedZone = w3wZones.find(z => z.id === matchResult.rows[0].zone_id);
        return { isVerified: true, zoneName: matchedZone.name };
      }
    }

    // Fall back to circular zones (less precise)
    for (const zone of authorizedZones) {
      if (zone.type !== 'w3w' && zone.latitude && zone.longitude && zone.radius) {
        const distance = getDistance(latitude, longitude, zone.latitude, zone.longitude);
        if (distance <= zone.radius) {
          return { isVerified: true, zoneName: zone.name };
        }
      }
    }

    return { isVerified: false, zoneName: null };
  } catch (err) {
    console.error("Error verifying location:", err.message);
    return { isVerified: false, zoneName: null };
  }
};

/**
 * Reverse-geocodes GPS coordinates to get a country code using OpenStreetMap Nominatim.
 * @returns {Promise<string|null>} ISO 3166-1 alpha-2 country code (e.g., "GB") or null.
 */
async function getCountryFromCoords(latitude, longitude) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&zoom=3`,
      { headers: { 'User-Agent': 'LBAS/1.0' } }
    );
    const data = await res.json();
    return data.address?.country_code?.toUpperCase() || null;
  } catch {
    return null;
  }
}

const isLocationSpoofed = async (ip, clientLatitude, clientLongitude) => {
  if (!ip) {
    return { isSpoofed: false }; // Cannot verify without IP
  }

  // Free geolocation services (no paid API key required)
  // ip-api.com: free tier, 45 req/min, HTTP only — returns countryCode
  // ipinfo.io: free tier, 50k req/month — returns country
  const services = [
    `http://ip-api.com/json/${ip}?fields=status,lat,lon,proxy,hosting,countryCode`,
    `https://ipinfo.io/${ip}/json?token=${process.env.IPINFO_TOKEN || ''}`,
  ];

  try {
    // Run IP geolocation and GPS reverse-geocoding in parallel
    const [ipResults, gpsCountry] = await Promise.all([
      Promise.allSettled(
        services.map((url) =>
          fetch(url).then((res) => res.json()).catch(() => null)
        )
      ),
      getCountryFromCoords(clientLatitude, clientLongitude),
    ]);

    let bestMatch = {
      distance: Infinity,
      ipLatitude: null,
      ipLongitude: null,
    };
    let ipCountry = null;

    for (const result of ipResults) {
      if (result.status === "fulfilled" && result.value) {
        const data = result.value;
        let lat, lon, isProxy = false, country = null;

        // Normalize data from different services
        if (data.lat && data.lon) {
          // ip-api.com format
          lat = data.lat;
          lon = data.lon;
          isProxy = data.proxy === true || data.hosting === true;
          country = data.countryCode || null;
        } else if (data.loc) {
          // ipinfo.io format
          [lat, lon] = data.loc.split(",").map(Number);
          isProxy =
            data.bogon ||
            (data.privacy && (data.privacy.vpn || data.privacy.proxy));
          country = data.country || null;
        }

        if (isProxy) {
          return { isSpoofed: true, reason: "proxy", ipLatitude: lat, ipLongitude: lon };
        }

        // Keep the first valid country code we find
        if (country && !ipCountry) {
          ipCountry = country.toUpperCase();
        }

        if (lat && lon) {
          const distance = getDistance(clientLatitude, clientLongitude, lat, lon);
          if (distance < bestMatch.distance) {
            bestMatch = { distance, ipLatitude: lat, ipLongitude: lon };
          }
        }
      }
    }

    // Primary check: country-level comparison
    if (ipCountry && gpsCountry) {
      if (ipCountry !== gpsCountry) {
        return { ...bestMatch, ipCountry, gpsCountry, isSpoofed: true, reason: "country_mismatch" };
      }
      // Same country — not spoofed
      return { ...bestMatch, ipCountry, gpsCountry, isSpoofed: false };
    }

    // Fallback: distance-based check (only if country comparison unavailable)
    if (bestMatch.distance > SPOOFING_DISTANCE_THRESHOLD) {
      return { ...bestMatch, isSpoofed: true, reason: "distance" };
    }

    return { ...bestMatch, isSpoofed: false };
  } catch (error) {
    console.error("Error in IP geolocation:", error.message);
    return { isSpoofed: false }; // Fail safe
  }
};

module.exports = {
  verifyLocation,
  isLocationSpoofed,
};
