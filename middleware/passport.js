const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const bcrypt = require('bcryptjs');
const pool = require('../db/postgre');

// Dummy hash for timing attack prevention
// Pre-computed bcrypt hash to use when user is not found
const DUMMY_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

// Account lockout settings
const MAX_FAILED_ATTEMPTS = 5;       // Lock after 5 failed attempts
const LOCKOUT_DURATION_MIN = 15;     // Lock for 15 minutes

// Local Strategy for username/password login
passport.use(new LocalStrategy(
    async (username, password, done) => {
        try {
            // Check for account lockout: count recent failed attempts
            const lockoutWindow = new Date(Date.now() - LOCKOUT_DURATION_MIN * 60 * 1000);
            const attemptsResult = await pool.query(
                'SELECT COUNT(*) FROM login_attempts WHERE username = $1 AND attempt_time > $2 AND success = FALSE',
                [username, lockoutWindow]
            );
            const failedAttempts = parseInt(attemptsResult.rows[0].count, 10);

            if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
                return done(null, false, { message: 'Account temporarily locked due to too many failed attempts. Try again in 15 minutes.' });
            }

            const userResult = await pool.query('SELECT * FROM users WHERE username = $1', [username]);

            // Always run bcrypt.compare to prevent timing attacks
            const user = userResult.rows[0];
            const hashToCompare = user ? user.password : DUMMY_HASH;
            const isMatch = await bcrypt.compare(password, hashToCompare);

            if (!user || !isMatch) {
                // Record failed attempt
                await pool.query(
                    'INSERT INTO login_attempts (username, success) VALUES ($1, FALSE)',
                    [username]
                );
                return done(null, false, { message: 'Invalid credentials' });
            }

            // Record successful login and clear failed attempts for this user
            await pool.query(
                'DELETE FROM login_attempts WHERE username = $1',
                [username]
            );

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
