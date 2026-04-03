require("dotenv").config();

const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

const users = [
  ["admin", "Admin@123", "admin"],
  ["cashier", "Cashier@123", "cashier"],
  ["kitchen", "Kitchen@123", "kitchen"],
  ["display", "Display@123", "display"],
];

const main = async () => {
  const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Set NEON_DATABASE_URL or DATABASE_URL before running this script");
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    for (const [username, password, role] of users) {
      const hash = await bcrypt.hash(password, 10);
      await pool.query(
        `INSERT INTO app_users (username, password_hash, role, is_active)
         VALUES ($1, $2, $3, TRUE)
         ON CONFLICT (username)
         DO UPDATE SET
           password_hash = EXCLUDED.password_hash,
           role = EXCLUDED.role,
           is_active = TRUE`,
        [username, hash, role]
      );
    }

    const result = await pool.query(
      `SELECT username, role, is_active
       FROM app_users
       WHERE username = ANY($1::text[])
       ORDER BY username`,
      [users.map((entry) => entry[0])]
    );

    console.log(JSON.stringify(result.rows, null, 2));
  } finally {
    await pool.end();
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});