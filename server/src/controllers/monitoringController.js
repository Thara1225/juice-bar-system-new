const pool = require("../config/db");

const healthCheck = async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime_seconds: process.uptime(),
      service: "juice-bar-api",
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
};

const uptimeSummary = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT COUNT(*)::INT AS total_orders,
              COALESCE(SUM(total_amount), 0) AS gross_sales,
              COALESCE(AVG(total_amount), 0) AS average_order_value
       FROM orders`
    );

    res.json({
      uptime_seconds: process.uptime(),
      totals: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch uptime summary" });
  }
};

module.exports = {
  healthCheck,
  uptimeSummary,
};
