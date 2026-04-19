const pool = require("../config/db");
const { generateToken } = require("../services/tokenService");
const PDFDocument = require("pdfkit");
const { publishOrderStatus } = require("../services/mqttService");

const LOYALTY_POINTS_PER_100_RUPEES = 1;

let io;
let cashierKitchenAssistEnabled = false;

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
        special_notes: row.special_notes,
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
    const { customer_phone, special_notes, items } = req.body;

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
      `INSERT INTO orders (token_number, customer_phone, special_notes, total_amount, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      ["TEMP", customer_phone || null, special_notes || null, totalAmount, "PENDING"]
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

    let loyaltyAccount = null;
    if (customer_phone) {
      const earnedPoints = Math.floor(Number(totalAmount) / 100) * LOYALTY_POINTS_PER_100_RUPEES;

      if (earnedPoints > 0) {
        const loyaltyResult = await client.query(
          `INSERT INTO loyalty_accounts (customer_phone, points, lifetime_points)
           VALUES ($1, $2, $2)
           ON CONFLICT (customer_phone)
           DO UPDATE
           SET points = loyalty_accounts.points + EXCLUDED.points,
               lifetime_points = loyalty_accounts.lifetime_points + EXCLUDED.lifetime_points,
               updated_at = NOW()
           RETURNING customer_phone, points, lifetime_points, updated_at`,
          [customer_phone, earnedPoints]
        );

        loyaltyAccount = {
          ...loyaltyResult.rows[0],
          earned_points: earnedPoints,
        };
      }
    }

    await client.query("COMMIT");

    if (io) {
      io.emit("order_created", orderUpdate.rows[0]);

      if (loyaltyAccount) {
        io.emit("loyalty_updated", loyaltyAccount);
      }
    }

    res.status(201).json({
      ...orderUpdate.rows[0],
      loyalty: loyaltyAccount,
    });
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
         o.special_notes,
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
         o.special_notes,
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

const getDisplayBoardOrders = async (req, res) => {
  try {
    const [readyResult, completedResult] = await Promise.all([
      pool.query(
        `SELECT
           o.id,
           o.token_number,
           o.customer_phone,
           o.special_notes,
           o.total_amount,
           o.status,
           o.ready_at,
           o.created_at,
           oi.menu_item_id,
           oi.quantity,
           oi.item_price,
           m.name AS menu_item_name
         FROM orders o
         LEFT JOIN order_items oi ON o.id = oi.order_id
         LEFT JOIN menu_items m ON oi.menu_item_id = m.id
         WHERE o.status = 'READY'
         ORDER BY COALESCE(o.ready_at, o.created_at) DESC, oi.id ASC`
      ),
      pool.query(
        `SELECT
           o.id,
           o.token_number,
           o.customer_phone,
           o.special_notes,
           o.total_amount,
           o.status,
           o.completed_at,
           o.created_at,
           oi.menu_item_id,
           oi.quantity,
           oi.item_price,
           m.name AS menu_item_name
         FROM orders o
         LEFT JOIN order_items oi ON o.id = oi.order_id
         LEFT JOIN menu_items m ON oi.menu_item_id = m.id
         WHERE o.status = 'COMPLETED'
         ORDER BY COALESCE(o.completed_at, o.created_at) DESC, oi.id ASC
         LIMIT 30`
      ),
    ]);

    res.json({
      readyOrders: formatOrdersWithItems(readyResult.rows),
      completedOrders: formatOrdersWithItems(completedResult.rows),
    });
  } catch (error) {
    console.error("Error fetching display board orders:", error.message);
    res.status(500).json({ error: "Failed to fetch display board orders" });
  }
};

const getAllOrders = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        o.*,
        FLOOR(o.total_amount / 100)::INT AS points_earned
       FROM orders
       o
       ORDER BY created_at DESC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching all orders:", error.message);
    res.status(500).json({ error: "Failed to fetch all orders" });
  }
};

const getSalesSummary = async (req, res) => {
  try {
    const [dailyResult, monthlyResult] = await Promise.all([
      pool.query(
        `SELECT
           TO_CHAR(DATE(o.created_at), 'YYYY-MM-DD') AS day,
           COUNT(*)::INT AS orders_count,
           ROUND(COALESCE(SUM(o.total_amount), 0)::NUMERIC, 2) AS sales_total
         FROM orders o
         WHERE o.status = 'COMPLETED'
         GROUP BY DATE(o.created_at)
         ORDER BY DATE(o.created_at) DESC
         LIMIT 31`
      ),
      pool.query(
        `SELECT
           TO_CHAR(DATE_TRUNC('month', o.created_at), 'YYYY-MM') AS month,
           COUNT(*)::INT AS orders_count,
           ROUND(COALESCE(SUM(o.total_amount), 0)::NUMERIC, 2) AS sales_total
         FROM orders o
         WHERE o.status = 'COMPLETED'
         GROUP BY DATE_TRUNC('month', o.created_at)
         ORDER BY DATE_TRUNC('month', o.created_at) DESC
         LIMIT 12`
      ),
    ]);

    res.json({
      daily: dailyResult.rows,
      monthly: monthlyResult.rows,
    });
  } catch (error) {
    console.error("Error fetching sales summary:", error.message);
    res.status(500).json({ error: "Failed to fetch sales summary" });
  }
};

const exportOrders = async (req, res) => {
  try {
    const format = String(req.query.format || "csv").toLowerCase();
    const result = await pool.query(
      `SELECT
         token_number,
         customer_phone,
         total_amount,
         status,
         created_at
       FROM orders
       ORDER BY created_at DESC`
    );

    if (format === "pdf") {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=orders-report.pdf");

      const doc = new PDFDocument({ margin: 40 });
      doc.pipe(res);

      doc.fontSize(18).text("Orders Report", { align: "left" });
      doc.moveDown(0.7);
      doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`);
      doc.moveDown();

      result.rows.forEach((order) => {
        doc
          .fontSize(11)
          .text(
            `Token: ${order.token_number || "-"} | Phone: ${order.customer_phone || "-"} | Total: Rs. ${order.total_amount} | Status: ${order.status} | Created: ${new Date(order.created_at).toLocaleString()}`
          );
        doc.moveDown(0.35);
      });

      doc.end();
      return;
    }

    const escapeCsv = (value) => {
      if (value === null || value === undefined) return "";
      const stringValue = String(value).replace(/"/g, '""');
      return `"${stringValue}"`;
    };

    const header = ["token_number", "customer_phone", "total_amount", "status", "created_at"];
    const rows = result.rows.map((order) => [
      escapeCsv(order.token_number),
      escapeCsv(order.customer_phone),
      escapeCsv(order.total_amount),
      escapeCsv(order.status),
      escapeCsv(new Date(order.created_at).toISOString()),
    ]);

    const csv = [header.join(","), ...rows.map((row) => row.join(","))].join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=orders-report.csv");
    res.send(csv);
  } catch (error) {
    console.error("Error exporting orders:", error.message);
    res.status(500).json({ error: "Failed to export orders" });
  }
};

const getCashierKitchenAssistMode = async (req, res) => {
  res.json({ enabled: cashierKitchenAssistEnabled });
};

const setCashierKitchenAssistMode = async (req, res) => {
  try {
    const { enabled } = req.body;

    if (typeof enabled !== "boolean") {
      return res.status(400).json({ error: "enabled must be boolean" });
    }

    cashierKitchenAssistEnabled = enabled;

    if (io) {
      io.emit("kitchen_assist_mode_updated", { enabled: cashierKitchenAssistEnabled });
    }

    res.json({ enabled: cashierKitchenAssistEnabled });
  } catch (error) {
    console.error("Error updating cashier kitchen assist mode:", error.message);
    res.status(500).json({ error: "Failed to update cashier kitchen assist mode" });
  }
};


const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const statusTimestampMap = {
      IN_PROGRESS: "prep_started_at",
      READY: "ready_at",
      COMPLETED: "completed_at",
      CANCELLED: "cancelled_at",
    };

    if (!statusTimestampMap[status]) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const timestampColumn = statusTimestampMap[status];

    const result = await pool.query(
      `UPDATE orders
       SET status = $1,
           ${timestampColumn} = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (io) {
      io.emit("order_status_updated", result.rows[0]);
    }

    await publishOrderStatus(result.rows[0]);

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
  getDisplayBoardOrders,
  updateOrderStatus,
  getAllOrders,
  getSalesSummary,
  exportOrders,
  getCashierKitchenAssistMode,
  setCashierKitchenAssistMode,
  setSocketInstance,
};
