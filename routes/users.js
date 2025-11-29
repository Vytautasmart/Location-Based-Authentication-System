const express = require("express");
const router = express.Router();
const pool = require("../db/postgre");

/* GET users listing. */
router.get("/", (req, res, next) => {
  res.send("respond with a resource");
});

router.post("/", async (req, res, next) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO users (username, password) VALUES ($1, $2) RETURNING *",
      [username, password]
    );
    res.status(201).json({
      message: "User created successfully",
      user: result.rows[0],
    });
  } catch (err) {
    console.error(err);
    next(err);
  }
});

router.get("./cool", (req, res, next) => {
  res.send("Youre so cool");
});

module.exports = router;
