const express = require('express');
const router = express.Router();

// POST /qr/location
router.post('/location', (req, res) => {
  const { lat, lon } = req.body;
  if (lat && lon) {
    // In a real application, you would save this to a database
    console.log(`Received location: Latitude: ${lat}, Longitude: ${lon}`);
    res.status(200).json({ message: 'Location received' });
  } else {
    res.status(400).json({ message: 'Invalid location data' });
  }
});

module.exports = router;
