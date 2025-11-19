const path = require("path");
require("dotenv").config({
  override: true,
  path: path.join(__dirname, "development.env"),
});
const { Pool, Client } = require("pg");

// Create a new PostgreSQL connection pool.
// Values are pulled from development.env that dotenv just loaded.
const pool = new Pool({
  user: process.env.USER,
  host: process.env.HOST,
  database: process.env.DATABASE,
  password: process.env.PASSWORD,
  port: process.env.PORT,
});

(async () => {
  // Acquire a client from the pool.
  const client = await pool.connect();
  try {
    // Execute a simple SQL query to get the current logged-in DB user.
    const resp = await client.query("SELECT current_user");
    // Extract the value from the first row of results.
    const currentUser = rows[0]["current_user"];
    console.log(currentUser);
  } catch (err) {
    // Print any error that occurred during the query.
    console.log(err);
  } finally {
    // Release the client back to the pool so others can use it.
    client.release();
  }
})();
