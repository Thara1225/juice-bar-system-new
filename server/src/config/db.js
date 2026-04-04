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

const normalizeSslMode = (rawUrl) => {
  const parsed = new URL(rawUrl);
  const sslmode = (parsed.searchParams.get("sslmode") || "").toLowerCase();

  // Keep current secure behavior and avoid pg warning for deprecated aliases.
  if (sslmode === "require") {
    parsed.searchParams.set("sslmode", "verify-full");
  }

  return parsed.toString();
};

const connectionString = normalizeSslMode(resolveDatabaseUrl());
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

pool.on("error", (err) => {
  // Idle clients can emit errors during transient network resets; log without crashing the process.
  console.error("❌ PostgreSQL pool error:", err.message);
});

pool
  .query("SELECT 1")
  .then(() => {
    console.log("✅ PostgreSQL connected successfully");
  })
  .catch((err) => {
    console.error("❌ PostgreSQL connection error:", err.message);
  });

module.exports = pool;