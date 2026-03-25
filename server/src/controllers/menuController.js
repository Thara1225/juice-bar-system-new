const pool = require("../config/db");

const getMenuItems = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM menu_items ORDER BY id ASC"
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching menu items:", error.message);
    res.status(500).json({ error: "Failed to fetch menu items" });
  }
};

const createMenuItem = async (req, res) => {
  try {
    const { name, price, category, is_available } = req.body;

    if (!name || !price) {
      return res.status(400).json({ error: "Name and price are required" });
    }

    const result = await pool.query(
      `INSERT INTO menu_items (name, price, category, is_available)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, price, category || null, is_available ?? true]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating menu item:", error.message);
    res.status(500).json({ error: "Failed to create menu item" });
  }
};

const updateMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, category, is_available } = req.body;

    const result = await pool.query(
      `UPDATE menu_items
       SET name = $1, price = $2, category = $3, is_available = $4
       WHERE id = $5
       RETURNING *`,
      [name, price, category, is_available, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Menu item not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating menu item:", error.message);
    res.status(500).json({ error: "Failed to update menu item" });
  }
};

const deleteMenuItem = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      "DELETE FROM menu_items WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Menu item not found" });
    }

    res.json({ message: "Menu item deleted successfully" });
  } catch (error) {
    console.error("Error deleting menu item:", error.message);
    res.status(500).json({ error: "Failed to delete menu item" });
  }
};

module.exports = {
  getMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
};
