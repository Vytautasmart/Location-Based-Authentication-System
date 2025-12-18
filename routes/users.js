// Import necessary packages
const express = require("express"); // Web framework for Node.js
const router = express.Router(); // Router object to handle routes
const pool = require("../db/postgre"); // Custom module for PostgreSQL connection pool
const bcrypt = require("bcryptjs"); // Library for hashing passwords
const passport = require("passport");

/* 
 * GET users listing. 
 * This is a placeholder route and is not currently used by the main application.
 */
router.get("/", (req, res, next) => {
  res.send("respond with a resource");
});

/**
 * @route   POST /users
 * @desc    Register a new user in the database with a hashed password.
 * @access  Public
 */
router.post("/", async (req, res, next) => {
  // Destructure the username and password from the request body.
  const { username, password } = req.body;

  try {
    // Generate a salt for the password hash. A salt adds random data to the password before hashing
    // to ensure that two identical passwords result in different hashes. 10 is the salt round,
    // a measure of how computationally expensive the hash creation will be.
    const salt = await bcrypt.genSalt(10);
    // Hash the user's password using the generated salt.
    const hashedPassword = await bcrypt.hash(password, salt);

    // Execute the SQL query to insert the new user into the "users" table.
    // We store the `hashedPassword`, never the original plain-text password.
    // "RETURNING *" tells the database to return the newly created user row, including the ID.
    const result = await pool.query(
      "INSERT INTO users (username, password, role) VALUES ($1, $2, 'user') RETURNING *",
      [username, hashedPassword]
    );
    
    // If the user was created successfully, send a 201 (Created) status code
    // along with a success message and the new user object (excluding the password).
    res.status(201).json({
      message: "User created successfully",
      user: result.rows[0],
    });
  } catch (err) {
    // This block catches errors that occur during the database operation.
    // We check for a specific error code from PostgreSQL.
    if (err.code === '23505') {
      // '23505' is the code for a "unique_violation". In this table, it means the username already exists.
      // We return a 400 (Bad Request) status with a user-friendly error message.
      return res.status(400).json({ message: "Username already exists." });
    }
    // For any other unexpected errors, we log them and pass them to the global error handler.
    console.error(err);
    next(err);
  }
});



router.get('/me', passport.authenticate('jwt', { session: false }), async (req, res) => {
    try {
        const user = await pool.query('SELECT id, username, role FROM users WHERE id = $1', [req.user.id]);
        res.json(user.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

/*
 * This is another placeholder route and is not part of the main application functionality.
 * Note: The path "./cool" is likely a typo and should be "/cool".
 */
router.get("/cool", (req, res, next) => {
  res.send("Youre so cool");
});

module.exports = router;
