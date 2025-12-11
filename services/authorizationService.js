/**
 * @file authorizationService.js
 * @description This service will be responsible for determining a user's access rights
 * based on their identity and context (like location).
 */

/**
 * Grants access based on the results of authentication and location verification.
 * 
 * @param {object} user - The authenticated user object.
 * @param {boolean} isLocationVerified - True if the user's location was successfully verified.
 * @returns {Promise<object>} - A promise that resolves to an object with access details.
 */
const grantAccess = async (user, isLocationVerified) => {
    console.log(`Granting access for user: ${user.id}, Role: ${user.role}, Location verified: ${isLocationVerified}`);

    // Admin users have access regardless of location
    if (user.role === 'admin') {
        console.log('Admin access granted.');
        return {
            access: 'granted',
            message: 'Admin access granted.'
        };
    }

    // Regular users must be in an authorized location
    if (isLocationVerified) {
        console.log('Access granted.');
        return {
            access: 'granted',
            message: 'User is in an authorized location.'
        };
    }

    console.log('Access denied.');
    return {
        access: 'denied',
        message: 'User is not in an authorized location.'
    };
};

module.exports = {
    grantAccess
};
