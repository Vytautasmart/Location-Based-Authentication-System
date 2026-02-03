/**
 * @file locationService.js
 * @description This service will be responsible for verifying the user's location.
 * In a real implementation, this would involve checking coordinates against geofenced zones.
 */

const pool = require("../db/postgre");

// Distance threshold for spoofing detection (50km)
const SPOOFING_DISTANCE_THRESHOLD = 50000;

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
 *
 * @param {object} locationData - The location data from the client (e.g., { latitude, longitude }).
 * @returns {Promise<boolean>} - A promise that resolves to true if the location is valid, false otherwise.
 */
const verifyLocation = async (locationData) => {
  if (!locationData || !locationData.latitude || !locationData.longitude) {
    return { isVerified: false, zoneName: null };
  }

  try {
    const { latitude, longitude } = locationData;
    const result = await pool.query("SELECT * FROM authorized_zones");
    const authorizedZones = result.rows;

    for (const zone of authorizedZones) {
      const distance = getDistance(
        latitude,
        longitude,
        zone.latitude,
        zone.longitude
      );
      if (distance <= zone.radius) {
        return { isVerified: true, zoneName: zone.name };
      }
    }

    return { isVerified: false, zoneName: null };
  } catch (err) {
    console.error("Error verifying location:", err.message);
    return { isVerified: false, zoneName: null };
  }
};

const isLocationSpoofed = async (ip, clientLatitude, clientLongitude) => {
  if (!ip) {
    return { isSpoofed: false }; // Cannot verify without IP
  }

  // Use HTTPS endpoints for geolocation services
  const services = [
    `https://pro.ip-api.com/json/${ip}?fields=status,lat,lon,proxy&key=${process.env.IP_API_KEY || ''}`,
    `https://ipinfo.io/${ip}/json?token=${process.env.IPINFO_TOKEN || ''}`,
  ];

  try {
    const promises = services.map((url) =>
      fetch(url)
        .then((res) => res.json())
        .catch(() => null)
    );
    const results = await Promise.allSettled(promises);

    let bestMatch = {
      distance: Infinity,
      ipLatitude: null,
      ipLongitude: null,
    };

    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        const data = result.value;
        let lat,
          lon,
          isProxy = false;

        // Normalize data from different services
        if (data.lat && data.lon) {
          // ip-api.com format
          lat = data.lat;
          lon = data.lon;
          isProxy = data.proxy === true;
        } else if (data.loc) {
          // ipinfo.io format
          [lat, lon] = data.loc.split(",").map(Number);
          isProxy =
            data.bogon ||
            (data.privacy && (data.privacy.vpn || data.privacy.proxy));
        } else if (data.latitude && data.longitude) {
          // freegeoip.app format
          lat = data.latitude;
          lon = data.longitude;
        }

        if (isProxy) {
          return { isSpoofed: true, reason: "proxy" };
        }

        if (lat && lon) {
          const distance = getDistance(
            clientLatitude,
            clientLongitude,
            lat,
            lon
          );
          if (distance < bestMatch.distance) {
            bestMatch = { distance, ipLatitude: lat, ipLongitude: lon };
          }
        }
      }
    }

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
