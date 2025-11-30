const express = require("express");
const router = express.Router();
const pool = require("../db/postgre");
const bcrypt = require("bcryptjs");

/* GET users listing. */
router.get("/", (req, res, next) => {
  res.send("respond with a resource");
});

/*
 * POST new user.
 * This route handles the creation of a new user in the database.
 * Input: A POST request to the "/users" endpoint with a JSON object in the request body,
 *        containing the `username` and `password`.
 * Output: A JSON object with a success message and the newly created user data, or an error message.
 */
router.post("/", async (req, res, next) => {
  // Destructure the username and password from the request body.
  const { username, password } = req.body;

  try {
    // Generate a salt and hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Execute the SQL query to insert the new user into the "users" table.
    const result = await pool.query(
      "INSERT INTO users (username, password) VALUES ($1, $2) RETURNING *",
      [username, hashedPassword]
    );
    // If the query is successful, send a 201 status
    res.status(201).json({
      message: "User created successfully",
      user: result.rows[0],
    });
  } catch (err) {
    // Check if the error is a unique violation
    if (err.code === '23505') {
      return res.status(400).json({ message: "Username already exists." });
    }
    // For other errors, pass them to the default error handler
    console.error(err);
    next(err);
  }
});

router.get("./cool", (req, res, next) => {
  res.send("Youre so cool");
});

module.exports = router;
