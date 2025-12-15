/**
 * @file locationService.js
 * @description This service will be responsible for verifying the user's location.
 * In a real implementation, this would involve checking coordinates against geofenced zones.
 */

const pool = require("../db/postgre");

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
  const φ1 = (lat1 * Math.PI) / 180; // φ, λ in radians
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
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
  console.log("Verifying location:", locationData);

  if (!locationData || !locationData.latitude || !locationData.longitude) {
    console.log("Location is invalid.");
    return false;
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
        console.log(`User is within zone: ${zone.name}`);
        return true;
      }
    }

    console.log("User is not in any authorized zone.");
    return false;
  } catch (err) {
    console.error("Error verifying location:", err.message);
    return false;
  }
};

const isLocationSpoofed = async (ip, clientLatitude, clientLongitude) => {
  if (!ip) {
    return { isSpoofed: false }; // Cannot verify without IP
  }

  console.log(`Checking IP geolocation for: ${ip} using multiple services.`);

  const services = [
    `http://ip-api.com/json/${ip}?fields=status,lat,lon,proxy`,
    `https://ipinfo.io/${ip}/json`,
    `https://freegeoip.app/json/${ip}`,
  ];

  try {
    const promises = services.map((url) =>
      fetch(url).then((res) => res.json())
    );
    const results = await Promise.allSettled(promises);

    console.log("Geolocation service results:", results);

    let bestMatch = {
      distance: Infinity,
      ipLatitude: null,
      ipLongitude: null,
    };

    for (const result of results) {
      if (result.status === "fulfilled") {
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
        } else if (data.location) {
          // ipinfo.io format
          [lat, lon] = data.location.split(",").map(Number);
          isProxy =
            data.bogon ||
            (data.privacy && (data.privacy.vpn || data.privacy.proxy));
        } else if (data.latitude && data.longitude) {
          // freegeoip.app format
          lat = data.latitude;
          lon = data.longitude;
        }

        if (isProxy) {
          console.log(`Potential spoofing detected. IP is a known proxy/VPN.`);
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

    console.log("Best match location found:", bestMatch);

    if (bestMatch.distance > 100000) {
      // 100km threshold
      console.log(
        `Potential spoofing detected. Best match IP location is more than 100km away.`
      );
      return { ...bestMatch, isSpoofed: true, reason: "distance" };
    }

    return { ...bestMatch, isSpoofed: false };
  } catch (error) {
    console.error("Error in multi-service IP geolocation:", error);
    return { isSpoofed: false }; // Fail safe
  }
};

module.exports = {
  verifyLocation,
  isLocationSpoofed,
};
