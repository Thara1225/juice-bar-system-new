const pool = require("../config/db");

const normalizePhone = (value) => String(value || "").trim();

const getLoyaltyByPhone = async (req, res) => {
  try {
    const customerPhone = normalizePhone(req.params.phone);

    if (!customerPhone) {
      return res.status(400).json({ error: "phone is required" });
    }

    const result = await pool.query(
      `SELECT customer_phone, points, lifetime_points, updated_at
       FROM loyalty_accounts
       WHERE customer_phone = $1`,
      [customerPhone]
    );

    if (result.rows.length === 0) {
      return res.json({
        customer_phone: customerPhone,
        points: 0,
        lifetime_points: 0,
        exists: false,
      });
    }

    res.json({ ...result.rows[0], exists: true });
  } catch (error) {
    console.error("Error fetching loyalty account:", error.message);
    res.status(500).json({ error: "Failed to fetch loyalty account" });
  }
};

const redeemLoyaltyPoints = async (req, res) => {
  const client = await pool.connect();

  try {
    const customerPhone = normalizePhone(req.body.customer_phone);
    const pointsToRedeem = Number(req.body.points || 0);

    if (!customerPhone) {
      return res.status(400).json({ error: "customer_phone is required" });
    }

    if (!Number.isInteger(pointsToRedeem) || pointsToRedeem <= 0) {
      return res.status(400).json({ error: "points must be a positive integer" });
    }

    await client.query("BEGIN");

    const accountResult = await client.query(
      `SELECT customer_phone, points, lifetime_points
       FROM loyalty_accounts
       WHERE customer_phone = $1
       FOR UPDATE`,
      [customerPhone]
    );

    if (accountResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Loyalty account not found" });
    }

    const account = accountResult.rows[0];

    if (Number(account.points) < pointsToRedeem) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Insufficient loyalty points" });
    }

    const updated = await client.query(
      `UPDATE loyalty_accounts
       SET points = points - $1,
           updated_at = NOW()
       WHERE customer_phone = $2
       RETURNING customer_phone, points, lifetime_points, updated_at`,
      [pointsToRedeem, customerPhone]
    );

    await client.query("COMMIT");

    res.json(updated.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error redeeming loyalty points:", error.message);
    res.status(500).json({ error: "Failed to redeem loyalty points" });
  } finally {
    client.release();
  }
};

const getLoyaltyLeaderboard = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT customer_phone, points, lifetime_points, updated_at
       FROM loyalty_accounts
       ORDER BY points DESC, updated_at DESC
       LIMIT 20`
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching loyalty leaderboard:", error.message);
    res.status(500).json({ error: "Failed to fetch loyalty leaderboard" });
  }
};

module.exports = {
  getLoyaltyByPhone,
  redeemLoyaltyPoints,
  getLoyaltyLeaderboard,
};
