const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const bcrypt = require('bcryptjs');
const pool = require('../db/postgre');

// Dummy hash for timing attack prevention
// Pre-computed bcrypt hash to use when user is not found
const DUMMY_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

// Local Strategy for username/password login
passport.use(new LocalStrategy(
    async (username, password, done) => {
        try {
            const userResult = await pool.query('SELECT * FROM users WHERE username = $1', [username]);

            // Always run bcrypt.compare to prevent timing attacks
            const user = userResult.rows[0];
            const hashToCompare = user ? user.password : DUMMY_HASH;
            const isMatch = await bcrypt.compare(password, hashToCompare);

            if (!user || !isMatch) {
                return done(null, false, { message: 'Invalid credentials' });
            }

            return done(null, user);
        } catch (err) {
            return done(err);
        }
    }
));

// JWT Strategy for protecting routes
const opts = {
    jwtFromRequest: ExtractJwt.fromHeader('x-auth-token'),
    secretOrKey: process.env.JWT_SECRET,
    algorithms: ['HS256'] // Explicitly specify allowed algorithms
};

passport.use(new JwtStrategy(opts, async (jwt_payload, done) => {
    try {
        // The payload contains the user ID. You can use it to find the user in the database if needed.
        // For now, the payload itself is sufficient.
        return done(null, jwt_payload.user);
    } catch (err) {
        return done(err, false);
    }
}));

module.exports = passport;
