/**
 * @file locationService.js
 * @description This service will be responsible for verifying the user's location.
 * In a real implementation, this would involve checking coordinates against geofenced zones.
 */

const pool = require('../db/postgre');

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
    const φ1 = lat1 * Math.PI / 180; // φ, λ in radians
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
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
    console.log('Verifying location:', locationData);

    if (!locationData || !locationData.latitude || !locationData.longitude) {
        console.log('Location is invalid.');
        return false;
    }

    try {
        const { latitude, longitude } = locationData;
        const result = await pool.query('SELECT * FROM authorized_zones');
        const authorizedZones = result.rows;

        for (const zone of authorizedZones) {
            const distance = getDistance(latitude, longitude, zone.latitude, zone.longitude);
            if (distance <= zone.radius) {
                console.log(`User is within zone: ${zone.name}`);
                return true;
            }
        }

        console.log('User is not in any authorized zone.');
        return false;
    } catch (err) {
        console.error('Error verifying location:', err.message);
        return false;
    }
};

module.exports = {
    verifyLocation
};
