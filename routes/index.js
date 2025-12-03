// Import necessary packages
const express = require("express"); // Web framework for Node.js
const router = express.Router(); // Router object to handle routes
const path = require("path"); // Node.js module for handling file paths

/**
 * @route   GET /
 * @desc    Serves the main login page.
 * @access  Public
 */
router.get("/", function (req, res, next) {
  // res.sendFile() is used to send a static file to the client.
  // path.join() creates a cross-platform compatible file path.
  // __dirname is a Node.js global variable that gives the directory name of the current module.
  // So, this line sends the 'index.html' file located in the 'public' directory.
  res.sendFile(path.join(__dirname, "../public", "index.html"));
});

/**
 * @route   GET /register
 * @desc    Serves the user registration page.
 * @access  Public
 */
router.get("/register", function (req, res, next) {
  // Similar to the root route, this sends the 'register.html' file
  // from the 'public' directory when a user navigates to the /register URL.
  res.sendFile(path.join(__dirname, "../public", "register.html"));
});

/**
 * @route   GET /test-location
 * @desc    Serves the location testing page.
 * @access  Public
 */
router.get("/test-location", function (req, res, next) {
  res.sendFile(path.join(__dirname, "../public", "test_location.html"));
});

// Export the router so it can be used by the main application file (app.js).
module.exports = router;
