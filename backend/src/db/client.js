const { Pool } = require("pg");

let pool = null;

function getDatabaseUrl() {
  return process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "";
}

function getPool() {
  if (pool) return pool;

  const connectionString = getDatabaseUrl();
  if (!connectionString) {
    throw new Error("MISSING_DB_URL");
  }

  pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  return pool;
}

async function checkDbConnection() {
  const db = getPool();
  const result = await db.query("select now() as now");
  return result.rows[0];
}

module.exports = {
  getPool,
  checkDbConnection,
};
