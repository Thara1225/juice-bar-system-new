const { Pool } = require("pg");
require("dotenv").config();

const resolveDatabaseUrl = () => {
  const candidates = [
    process.env.NEON_DATABASE_URL,
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL,
  ].map((value) => String(value || "").trim());

  const resolved = candidates.find(Boolean);
  if (!resolved) {
    throw new Error("No database URL found. Set NEON_DATABASE_URL or DATABASE_URL.");
  }

  return resolved;
};

const connectionString = resolveDatabaseUrl();
const parsedUrl = new URL(connectionString);
if (parsedUrl.hostname === "base") {
  throw new Error(
    "Invalid DB host 'base'. Your platform variable appears unresolved. Set DATABASE_URL (or NEON_DATABASE_URL) directly to the full Neon URL."
  );
}

const isLocalConnection = /localhost|127\.0\.0\.1/.test(parsedUrl.hostname || "");
const disableSsl = (process.env.PGSSLMODE || "").toLowerCase() === "disable";

const pool = new Pool({
  connectionString,
  ssl: disableSsl || isLocalConnection ? false : { rejectUnauthorized: false },
});

console.log(`DB target host: ${parsedUrl.hostname}`);

pool.connect()
  .then(() => {
    console.log("✅ PostgreSQL connected successfully");
  })
  .catch((err) => {
    console.error("❌ PostgreSQL connection error:", err.message);
  });

module.exports = pool;