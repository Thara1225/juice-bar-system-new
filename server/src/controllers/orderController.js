const pool = require("../config/db");
const { generateToken } = require("../services/tokenService");

let io;

const setSocketInstance = (socketIo) => {
  io = socketIo;
};

const formatOrdersWithItems = (rows) => {
  const ordersMap = new Map();

  rows.forEach((row) => {
    if (!ordersMap.has(row.id)) {
      ordersMap.set(row.id, {
        id: row.id,
        token_number: row.token_number,
        customer_phone: row.customer_phone,
        total_amount: row.total_amount,
        status: row.status,
        created_at: row.created_at,
        items: [],
      });
    }

    if (row.menu_item_id) {
      ordersMap.get(row.id).items.push({
        menu_item_id: row.menu_item_id,
        name: row.menu_item_name,
        quantity: row.quantity,
        item_price: row.item_price,
      });
    }
  });

  return Array.from(ordersMap.values());
};

const createOrder = async (req, res) => {
  const client = await pool.connect();

  try {
    const { customer_phone, items } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: "Items are required" });
    }

    await client.query("BEGIN");

    let totalAmount = 0;

    for (const item of items) {
      const menuResult = await client.query(
        "SELECT * FROM menu_items WHERE id = $1",
        [item.menu_item_id]
      );

      if (menuResult.rows.length === 0) {
        throw new Error(`Menu item ${item.menu_item_id} not found`);
      }

      const menuItem = menuResult.rows[0];
      totalAmount += Number(menuItem.price) * Number(item.quantity);
    }

    const orderInsert = await client.query(
      `INSERT INTO orders (token_number, customer_phone, total_amount, status)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      ["TEMP", customer_phone || null, totalAmount, "PENDING"]
    );

    const order = orderInsert.rows[0];
    const token = generateToken(order.id);

    const orderUpdate = await client.query(
      `UPDATE orders
       SET token_number = $1
       WHERE id = $2
       RETURNING *`,
      [token, order.id]
    );

    for (const item of items) {
      const menuResult = await client.query(
        "SELECT * FROM menu_items WHERE id = $1",
        [item.menu_item_id]
      );

      const menuItem = menuResult.rows[0];

      await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, quantity, item_price)
         VALUES ($1, $2, $3, $4)`,
        [order.id, item.menu_item_id, item.quantity, menuItem.price]
      );
    }

    await client.query("COMMIT");

    if (io) {
      io.emit("order_created", orderUpdate.rows[0]);
    }

    res.status(201).json(orderUpdate.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating order:", error.message);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
};

const getPendingOrders = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         o.id,
         o.token_number,
         o.customer_phone,
         o.total_amount,
         o.status,
         o.created_at,
         oi.menu_item_id,
         oi.quantity,
         oi.item_price,
         m.name AS menu_item_name
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       LEFT JOIN menu_items m ON oi.menu_item_id = m.id
       WHERE o.status = 'PENDING'
       ORDER BY o.created_at ASC, oi.id ASC`
    );

    const formattedOrders = formatOrdersWithItems(result.rows);
    res.json(formattedOrders);
  } catch (error) {
    console.error("Error fetching pending orders:", error.message);
    res.status(500).json({ error: "Failed to fetch pending orders" });
  }
};

const getReadyOrders = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         o.id,
         o.token_number,
         o.customer_phone,
         o.total_amount,
         o.status,
         o.created_at,
         oi.menu_item_id,
         oi.quantity,
         oi.item_price,
         m.name AS menu_item_name
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       LEFT JOIN menu_items m ON oi.menu_item_id = m.id
       WHERE o.status = 'READY'
       ORDER BY o.created_at ASC, oi.id ASC`
    );

    const formattedOrders = formatOrdersWithItems(result.rows);
    res.json(formattedOrders);
  } catch (error) {
    console.error("Error fetching ready orders:", error.message);
    res.status(500).json({ error: "Failed to fetch ready orders" });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["READY", "COMPLETED"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const result = await pool.query(
      "UPDATE orders SET status = $1 WHERE id = $2 RETURNING *",
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (io) {
      io.emit("order_status_updated", result.rows[0]);
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating order status:", error.message);
    res.status(500).json({ error: "Failed to update order status" });
  }
};

module.exports = {
  createOrder,
  getPendingOrders,
  getReadyOrders,
  updateOrderStatus,
  setSocketInstance,
};