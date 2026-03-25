const pool = require("../config/db");

const getPromoCodes = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM promo_codes ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching promo codes:", error.message);
    res.status(500).json({ error: "Failed to fetch promo codes" });
  }
};

const createPromoCode = async (req, res) => {
  try {
    const code = String(req.body.code || "").trim().toUpperCase();
    const discountType = String(req.body.discount_type || "").trim().toLowerCase();
    const discountValue = Number(req.body.discount_value || 0);
    const minOrderAmount = Number(req.body.min_order_amount || 0);
    const startsAt = req.body.starts_at || null;
    const endsAt = req.body.ends_at || null;

    if (!code || !["percentage", "fixed"].includes(discountType) || discountValue <= 0) {
      return res.status(400).json({ error: "Invalid promo code payload" });
    }

    const result = await pool.query(
      `INSERT INTO promo_codes
       (code, discount_type, discount_value, min_order_amount, starts_at, ends_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [code, discountType, discountValue, minOrderAmount, startsAt, endsAt]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating promo code:", error.message);
    res.status(500).json({ error: "Failed to create promo code" });
  }
};

const getHappyHours = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM happy_hour_rules ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching happy hour rules:", error.message);
    res.status(500).json({ error: "Failed to fetch happy hour rules" });
  }
};

const createHappyHourRule = async (req, res) => {
  try {
    const {
      name,
      discount_type,
      discount_value,
      start_time,
      end_time,
      days_of_week,
    } = req.body;

    if (!name || !start_time || !end_time || !["percentage", "fixed"].includes(discount_type)) {
      return res.status(400).json({ error: "Invalid happy hour payload" });
    }

    const result = await pool.query(
      `INSERT INTO happy_hour_rules
       (name, discount_type, discount_value, start_time, end_time, days_of_week)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        String(name).trim(),
        String(discount_type).trim().toLowerCase(),
        Number(discount_value || 0),
        start_time,
        end_time,
        days_of_week || "1,2,3,4,5,6,0",
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating happy hour rule:", error.message);
    res.status(500).json({ error: "Failed to create happy hour rule" });
  }
};

module.exports = {
  getPromoCodes,
  createPromoCode,
  getHappyHours,
  createHappyHourRule,
};
