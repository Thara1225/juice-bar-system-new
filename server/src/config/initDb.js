const pool = require("./db");
const bcrypt = require("bcryptjs");

const initDb = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS business_settings (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      business_name TEXT NOT NULL DEFAULT 'Juice Bar',
      logo_url TEXT,
      contact_number TEXT,
      address TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    INSERT INTO business_settings (id, business_name)
    VALUES (1, 'Juice Bar')
    ON CONFLICT (id) DO NOTHING;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      price NUMERIC(10,2) NOT NULL,
      category TEXT,
      is_available BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      token_number VARCHAR(20) UNIQUE,
      customer_phone VARCHAR(30),
      total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'PENDING',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL,
      item_price NUMERIC(10,2) NOT NULL
    );
  `);

  await pool.query(`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS special_notes TEXT;
  `);

  await pool.query(`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS customer_email TEXT;
  `);

  await pool.query(`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS subtotal_amount NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS promo_code TEXT,
    ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'normal',
    ADD COLUMN IF NOT EXISTS prep_started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS prep_sla_minutes INTEGER DEFAULT 15,
    ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
  `);

  await pool.query(`
    UPDATE orders
    SET subtotal_amount = total_amount
    WHERE subtotal_amount IS NULL;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'cashier', 'kitchen', 'display')),
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS promo_codes (
      id SERIAL PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
      discount_value NUMERIC(10,2) NOT NULL,
      min_order_amount NUMERIC(10,2) DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      starts_at TIMESTAMPTZ,
      ends_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS happy_hour_rules (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
      discount_value NUMERIC(10,2) NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      days_of_week TEXT NOT NULL DEFAULT '1,2,3,4,5,6,0',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS loyalty_accounts (
      id SERIAL PRIMARY KEY,
      customer_phone VARCHAR(30) UNIQUE NOT NULL,
      points INTEGER NOT NULL DEFAULT 0,
      lifetime_points INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      content TEXT NOT NULL,
      audience VARCHAR(20) NOT NULL DEFAULT 'all',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ingredients (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      stock_quantity NUMERIC(10,2) NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT 'unit',
      reorder_level NUMERIC(10,2) NOT NULL DEFAULT 10,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS menu_item_ingredients (
      id SERIAL PRIMARY KEY,
      menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
      ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
      quantity_required NUMERIC(10,2) NOT NULL,
      UNIQUE (menu_item_id, ingredient_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory_alerts (
      id SERIAL PRIMARY KEY,
      ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
      alert_type TEXT NOT NULL,
      message TEXT NOT NULL,
      is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notification_logs (
      id SERIAL PRIMARY KEY,
      order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
      channel TEXT NOT NULL,
      recipient TEXT,
      message TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_metrics (
      id SERIAL PRIMARY KEY,
      metric_key TEXT NOT NULL,
      metric_value NUMERIC(12,2) NOT NULL,
      recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const usersCount = await pool.query("SELECT COUNT(*)::INT AS count FROM app_users");
  if (usersCount.rows[0].count === 0) {
    const defaultUsers = [
      { username: "admin", password: "Admin@123", role: "admin" },
      { username: "cashier", password: "Cashier@123", role: "cashier" },
      { username: "kitchen", password: "Kitchen@123", role: "kitchen" },
      { username: "display", password: "Display@123", role: "display" },
    ];

    for (const user of defaultUsers) {
      const hash = await bcrypt.hash(user.password, 10);
      await pool.query(
        `INSERT INTO app_users (username, password_hash, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (username) DO NOTHING`,
        [user.username, hash, user.role]
      );
    }
  }
};

module.exports = initDb;
