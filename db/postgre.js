const path = require("path");
require("dotenv").config({
  override: true,
  path: path.join(__dirname, "development.env"),
});
const { Pool } = require("pg");

// Create a new PostgreSQL connection pool using the connection string.
const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_kR3QrcJ5iobU@ep-lively-lake-abc3f4ul-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require",
});

module.exports = pool;
