const fetch = require('node-fetch');

/**
 * Gets the geographic location for a given IP address using the ip-api.com service.
 * @param {string} ip - The IP address to geolocate.
 * @returns {Promise<object|null>} - A promise that resolves to an object with location data (lat, lon) or null on failure.
 */
const getLocationFromIp = async (ip) => {
  try {
    // We use a specific IP for testing since localhost IPs (127.0.0.1, ::1) are not geolocatable.
    const requestIp = (ip === '::1' || ip === '127.0.0.1') ? '8.8.8.8' : ip;
    const response = await fetch(`http://ip-api.com/json/${requestIp}`);
    const data = await response.json();

    if (data.status === 'success') {
      return {
        lat: data.lat,
        lon: data.lon,
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching location from IP:', error);
    return null;
  }
};

module.exports = {
  getLocationFromIp,
};
