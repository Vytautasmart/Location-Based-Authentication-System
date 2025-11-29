const express = require("express");
const router = express.Router();
const pool = require("../db/postgre");

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
    // Execute the SQL query to insert the new user into the "users" table.
    // The "$1" and "$2" are placeholders for the username and password values, which helps prevent SQL injection attacks.
    // "RETURNING *" tells the database to return the newly created row.
    const result = await pool.query(
      "INSERT INTO users (username, password) VALUES ($1, $2) RETURNING *",
      [username, password]
    );
    // If the query is successful, send a 201 (Created) status code and a JSON response with a success message
    // and the data of the newly created user.
    res.status(201).json({
      message: "User created successfully",
      user: result.rows[0],
    });
  } catch (err) {
    // If there is an error, log it to the console and pass it to the error handling middleware.
    console.error(err);
    next(err);
  }
});

router.get("./cool", (req, res, next) => {
  res.send("Youre so cool");
});

module.exports = router;
