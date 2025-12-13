const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const bcrypt = require('bcryptjs');
const pool = require('../db/postgre');

// Local Strategy for username/password login
passport.use(new LocalStrategy(
    async (username, password, done) => {
        try {
            const userResult = await pool.query('SELECT * FROM users WHERE username = $1', [username]);

            if (userResult.rows.length === 0) {
                return done(null, false, { message: 'Invalid credentials' });
            }

            const user = userResult.rows[0];
            const isMatch = await bcrypt.compare(password, user.password);

            if (!isMatch) {
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
    secretOrKey: process.env.JWT_SECRET
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
