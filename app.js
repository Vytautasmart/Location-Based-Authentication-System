require('dotenv').config();
// Import necessary packages
const createError = require("http-errors"); // For creating HTTP error objects
const express = require("express"); // The main web framework
const path = require("path"); // For handling file paths
const cookieParser = require("cookie-parser"); // For parsing cookies from the request
const logger = require("morgan"); // For logging HTTP request details
const helmet = require("helmet"); // Security headers
const cors = require("cors"); // CORS configuration
const rateLimit = require("express-rate-limit"); // Rate limiting

// Import route modules
const usersRouter = require("./routes/users"); // Handles routes for user registration (/users)
const authRouter = require('./routes/auth');   // Handles routes for authentication (/api/auth/login)
const zonesRouter = require('./routes/zones');   // Handles routes for managing authorized zones.
const passport = require('./middleware/passport');

// Initialize the Express application
const app = express();
// Trust first proxy only (more secure than 'true')
app.set('trust proxy', 1);

// --- Security Middleware ---
// Helmet sets various HTTP headers to help protect against common vulnerabilities
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
      scriptSrc: ["'self'", "https://unpkg.com"],
      imgSrc: ["'self'", "data:", "https://*.tile.openstreetmap.org", "https://unpkg.com"],
      connectSrc: ["'self'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
  },
}));

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || ['https://localhost:3443', 'https://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-auth-token', 'Authorization'],
};
app.use(cors(corsOptions));

// Rate limiting for authentication routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { msg: 'Too many requests from this IP, please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for registration to prevent bot abuse
const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 registration attempts per hour
  message: { msg: 'Too many registration attempts from this IP, please try again after an hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// --- Middleware Setup ---
// Middleware are functions that execute during the lifecycle of a request to the server.
// They are executed in the order they are defined.

// Use morgan for logging. 'dev' format provides concise, color-coded output for development.
app.use(logger("dev"));
// Parse incoming JSON payloads. This allows us to access `req.body`.
app.use(express.json({ limit: '10kb' })); // Limit body size
// Parse URL-encoded payloads (e.g., from HTML forms). `extended: false` uses the classic encoding.
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
// Parse cookies attached to the client request.
app.use(cookieParser());
// Serve static files (like HTML, CSS, images, and client-side JS) from the 'frontend/dist' directory.
app.use(express.static(path.join(__dirname, 'frontend', 'dist')));
app.use(passport.initialize());

// --- Route Handling ---
// Mount the imported route modules to specific URL prefixes.
app.use('/api/users', registrationLimiter, usersRouter); // Routes for user registration with rate limiting
app.use('/api/auth', authLimiter, authRouter); // Routes for authentication API with rate limiting
app.use('/api/zones', zonesRouter); // Routes for managing authorized zones

// Catch-all route to serve the React app's index.html for client-side routing
app.use((req, res, next) => {
  // If the request is not for an API route, send the index.html file.
  if (req.path.startsWith('/api/')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'frontend', 'dist', 'index.html'));
});


// --- Error Handling ---

// Catch 404 errors. If a request doesn't match any of the routes above,
// this middleware is triggered. It creates a 404 error and passes it to the next error handler.
app.use((req, res, next) => {
  next(createError(404));
});

// Global error handler. This middleware catches all errors passed by `next(err)`.
app.use((err, req, res, next) => {
  // Log error for debugging (but not to client)
  console.error('Error:', err.message);

  // In production, don't leak error details
  const isProduction = req.app.get("env") === "production";
  const status = err.status || 500;

  res.status(status);
  res.json({
    error: isProduction && status === 500 ? 'Internal server error' : err.message
  });
});

// Export the configured Express app so it can be used by the server startup script (bin/www).
module.exports = app;
