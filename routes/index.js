const express = require("express");
const router = express.Router();
const path = require("path");

/*
 * GET home page.
 * This route serves the main `index.html` page to the client.
 * Input: A GET request to the root URL ("/").
 * Output: The `index.html` file.
 */
router.get("/", function (req, res, next) {
  res.sendFile(path.join(__dirname, "../public", "index.html"));
});

module.exports = router;
