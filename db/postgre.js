require("dotenv").config();
const { Pool } = require("pg");

// Create a new PostgreSQL connection pool using the connection string.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

module.exports = pool;
