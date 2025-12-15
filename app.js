require('dotenv').config();
// Import necessary packages
const createError = require("http-errors"); // For creating HTTP error objects
const express = require("express"); // The main web framework
const path = require("path"); // For handling file paths
const cookieParser = require("cookie-parser"); // For parsing cookies from the request
const logger = require("morgan"); // For logging HTTP request details

// Import route modules
const indexRouter = require("./routes/index"); // Handles routes for serving HTML pages (/, /register)
const usersRouter = require("./routes/users"); // Handles routes for user registration (/users)
const authRouter = require('./routes/auth');   // Handles routes for authentication (/api/auth/login)
const zonesRouter = require('./routes/zones');   // Handles routes for managing authorized zones.
const passport = require('./middleware/passport');

// Initialize the Express application
const app = express();
app.set('trust proxy', true);

// --- Middleware Setup ---
// Middleware are functions that execute during the lifecycle of a request to the server.
// They are executed in the order they are defined.

// Use morgan for logging. 'dev' format provides concise, color-coded output for development.
app.use(logger("dev"));
// Parse incoming JSON payloads. This allows us to access `req.body`.
app.use(express.json());
// Parse URL-encoded payloads (e.g., from HTML forms). `extended: false` uses the classic encoding.
app.use(express.urlencoded({ extended: false }));
// Parse cookies attached to the client request.
app.use(cookieParser());
// Serve static files (like HTML, CSS, images, and client-side JS) from the 'frontend/dist' directory.
app.use(express.static(path.join(__dirname, 'frontend', 'dist')));
// app.use(express.static(path.join(__dirname, "public"))); // Commented out, replaced by React app
app.use(passport.initialize());

// --- Route Handling ---
// Mount the imported route modules to specific URL prefixes.
// app.use("/", indexRouter); // Commented out, replaced by React app
app.use('/api/users', usersRouter); // Routes for user registration
app.use('/api/auth', authRouter); // Routes for authentication API
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
  // Set locals, only providing the full error object in the development environment for debugging.
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // Send the error response as JSON.
  // Use the error's status code or default to 500 (Internal Server Error).
  res.status(err.status || 500);
  res.json({ error: err.message });
});

// Export the configured Express app so it can be used by the server startup script (bin/www).
module.exports = app;
