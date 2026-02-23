// Load environment variables from a .env file into process.env
require("dotenv").config();
const { Pool } = require("pg");

// Create a new PostgreSQL connection pool.
// A connection pool is a cache of database connections maintained so that the
// connections can be reused when future requests to the database are required.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Keep connections fresh — important for NeonDB which auto-suspends after inactivity.
  // Idle connections are released after 30s, and new connection attempts time out after 5s.
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Handle pool errors to prevent unhandled promise rejections
pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err.message);
});

// Export the connection pool so it can be used in other parts of the application.
module.exports = pool;
