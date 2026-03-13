const pool = require("../config/db");

const getMenuItems = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM menu_items WHERE is_available = true ORDER BY id ASC"
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching menu items:", error.message);
    res.status(500).json({ error: "Failed to fetch menu items" });
  }
};

module.exports = { getMenuItems };