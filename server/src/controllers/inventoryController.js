const pool = require("../config/db");

const getIngredients = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM ingredients ORDER BY name ASC");
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching ingredients:", error.message);
    res.status(500).json({ error: "Failed to fetch ingredients" });
  }
};

const createIngredient = async (req, res) => {
  try {
    const { name, stock_quantity, unit, reorder_level } = req.body;

    if (!name) {
      return res.status(400).json({ error: "name is required" });
    }

    const result = await pool.query(
      `INSERT INTO ingredients (name, stock_quantity, unit, reorder_level)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        String(name).trim(),
        Number(stock_quantity || 0),
        String(unit || "unit").trim(),
        Number(reorder_level || 10),
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating ingredient:", error.message);
    res.status(500).json({ error: "Failed to create ingredient" });
  }
};

const assignIngredientToMenuItem = async (req, res) => {
  try {
    const menuItemId = Number(req.params.menuItemId);
    const ingredientId = Number(req.body.ingredient_id);
    const quantityRequired = Number(req.body.quantity_required);

    if (!menuItemId || !ingredientId || quantityRequired <= 0) {
      return res.status(400).json({ error: "Invalid ingredient assignment payload" });
    }

    const result = await pool.query(
      `INSERT INTO menu_item_ingredients (menu_item_id, ingredient_id, quantity_required)
       VALUES ($1, $2, $3)
       ON CONFLICT (menu_item_id, ingredient_id)
       DO UPDATE SET quantity_required = EXCLUDED.quantity_required
       RETURNING *`,
      [menuItemId, ingredientId, quantityRequired]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error assigning ingredient to menu item:", error.message);
    res.status(500).json({ error: "Failed to assign ingredient" });
  }
};

const getLowStockAlerts = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT i.id, i.name, i.stock_quantity, i.reorder_level, i.unit
       FROM ingredients i
       WHERE i.stock_quantity <= i.reorder_level
       ORDER BY i.stock_quantity ASC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching low stock alerts:", error.message);
    res.status(500).json({ error: "Failed to fetch low stock alerts" });
  }
};

module.exports = {
  getIngredients,
  createIngredient,
  assignIngredientToMenuItem,
  getLowStockAlerts,
};
