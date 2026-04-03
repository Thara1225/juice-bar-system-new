const PDFDocument = require("pdfkit");
const pool = require("../config/db");
const { generateToken } = require("../services/tokenService");
const { sendReadyNotification } = require("../services/notificationService");

const LOYALTY_POINTS_PER_100_RUPEES = 1;

let io;
let cashierKitchenAssistEnabled = false;

const setSocketInstance = (socketIo) => {
  io = socketIo;
};

const toNumber = (value) => Number(value || 0);

const calculateDiscount = (subtotal, type, value) => {
  if (type === "percentage") {
    return Math.min(subtotal, (subtotal * Number(value || 0)) / 100);
  }

  return Math.min(subtotal, Number(value || 0));
};

const applyDiscountRules = async (client, subtotalAmount, promoCode) => {
  let promoDiscount = 0;
  let promoCodeApplied = null;
  let happyHourDiscount = 0;

  if (promoCode) {
    const promoResult = await client.query(
      `SELECT *
       FROM promo_codes
       WHERE code = UPPER($1)
         AND is_active = TRUE
         AND (starts_at IS NULL OR starts_at <= NOW())
         AND (ends_at IS NULL OR ends_at >= NOW())`,
      [promoCode]
    );

    if (promoResult.rows.length === 0) {
      throw new Error("Invalid or inactive promo code");
    }

    const promo = promoResult.rows[0];
    if (subtotalAmount < Number(promo.min_order_amount || 0)) {
      throw new Error(`Promo code requires minimum order of ${promo.min_order_amount}`);
    }

    promoDiscount = calculateDiscount(subtotalAmount, promo.discount_type, promo.discount_value);
    promoCodeApplied = promo.code;
  }

  const happyHourResult = await client.query(
    `SELECT *
     FROM happy_hour_rules
     WHERE is_active = TRUE
       AND POSITION(EXTRACT(DOW FROM NOW())::TEXT IN days_of_week) > 0
       AND start_time <= CURRENT_TIME
       AND end_time >= CURRENT_TIME
     ORDER BY discount_value DESC
     LIMIT 1`
  );

  if (happyHourResult.rows.length > 0) {
    const rule = happyHourResult.rows[0];
    const eligibleBase = Math.max(0, subtotalAmount - promoDiscount);
    happyHourDiscount = calculateDiscount(eligibleBase, rule.discount_type, rule.discount_value);
  }

  const discountAmount = Number((promoDiscount + happyHourDiscount).toFixed(2));
  const totalAmount = Math.max(0, Number((subtotalAmount - discountAmount).toFixed(2)));

  return {
    promoCodeApplied,
    discountAmount,
    totalAmount,
  };
};

const consumeIngredientsAndUpdateAvailability = async (client, items) => {
  const consumptionPlan = [];

  for (const item of items) {
    const recipeResult = await client.query(
      `SELECT i.id, i.name, i.stock_quantity, i.reorder_level, mii.quantity_required
       FROM menu_item_ingredients mii
       INNER JOIN ingredients i ON i.id = mii.ingredient_id
       WHERE mii.menu_item_id = $1`,
      [item.menu_item_id]
    );

    for (const recipe of recipeResult.rows) {
      const needed = Number(recipe.quantity_required) * Number(item.quantity);
      const available = Number(recipe.stock_quantity);

      if (available < needed) {
        throw new Error(`Insufficient ingredient stock: ${recipe.name}`);
      }

      consumptionPlan.push({
        ingredientId: recipe.id,
        ingredientName: recipe.name,
        consumeQty: needed,
      });
    }
  }

  for (const entry of consumptionPlan) {
    const stockUpdate = await client.query(
      `UPDATE ingredients
       SET stock_quantity = stock_quantity - $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING id, stock_quantity, reorder_level`,
      [entry.consumeQty, entry.ingredientId]
    );

    const ingredient = stockUpdate.rows[0];
    if (Number(ingredient.stock_quantity) <= Number(ingredient.reorder_level)) {
      await client.query(
        `INSERT INTO inventory_alerts (ingredient_id, alert_type, message)
         SELECT $1, 'LOW_STOCK', $2
         WHERE NOT EXISTS (
           SELECT 1
           FROM inventory_alerts
           WHERE ingredient_id = $1
             AND alert_type = 'LOW_STOCK'
             AND is_resolved = FALSE
         )`,
        [
          entry.ingredientId,
          `${entry.ingredientName} is low on stock (${ingredient.stock_quantity}).`,
        ]
      );
    }
  }

  await client.query(
    `UPDATE menu_items mi
     SET is_available = NOT EXISTS (
       SELECT 1
       FROM menu_item_ingredients mii
       INNER JOIN ingredients i ON i.id = mii.ingredient_id
       WHERE mii.menu_item_id = mi.id
         AND i.stock_quantity < mii.quantity_required
     )`
  );
};

const formatOrdersWithItems = (rows) => {
  const ordersMap = new Map();

  rows.forEach((row) => {
    if (!ordersMap.has(row.id)) {
      ordersMap.set(row.id, {
        id: row.id,
        token_number: row.token_number,
        customer_phone: row.customer_phone,
        customer_email: row.customer_email,
        special_notes: row.special_notes,
        subtotal_amount: row.subtotal_amount,
        discount_amount: row.discount_amount,
        total_amount: row.total_amount,
        promo_code: row.promo_code,
        priority: row.priority,
        status: row.status,
        prep_started_at: row.prep_started_at,
        ready_at: row.ready_at,
        prep_sla_minutes: row.prep_sla_minutes,
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
    const {
      customer_phone,
      customer_email,
      special_notes,
      promo_code,
      priority,
      items,
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: "Items are required" });
    }

    const normalizedPriority = String(priority || "normal").toLowerCase();
    if (!["normal", "urgent", "vip", "bulk"].includes(normalizedPriority)) {
      return res.status(400).json({ error: "Invalid priority" });
    }

    await client.query("BEGIN");

    let subtotalAmount = 0;

    for (const item of items) {
      const menuResult = await client.query("SELECT * FROM menu_items WHERE id = $1", [item.menu_item_id]);

      if (menuResult.rows.length === 0) {
        throw new Error(`Menu item ${item.menu_item_id} not found`);
      }

      const menuItem = menuResult.rows[0];
      if (!menuItem.is_available) {
        throw new Error(`Menu item ${menuItem.name} is currently unavailable`);
      }

      subtotalAmount += toNumber(menuItem.price) * toNumber(item.quantity);
    }

    const discount = await applyDiscountRules(client, subtotalAmount, promo_code);

    const orderInsert = await client.query(
      `INSERT INTO orders
       (token_number, customer_phone, customer_email, special_notes, subtotal_amount, discount_amount, total_amount, promo_code, priority, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        "TEMP",
        customer_phone || null,
        customer_email || null,
        special_notes || null,
        subtotalAmount,
        discount.discountAmount,
        discount.totalAmount,
        discount.promoCodeApplied,
        normalizedPriority,
        "PENDING",
      ]
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
      const menuResult = await client.query("SELECT * FROM menu_items WHERE id = $1", [item.menu_item_id]);
      const menuItem = menuResult.rows[0];

      if (!menuItem.is_available) {
        throw new Error(`Menu item ${menuItem.name} is currently unavailable`);
      }

      await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, quantity, item_price)
         VALUES ($1, $2, $3, $4)`,
        [order.id, item.menu_item_id, item.quantity, menuItem.price]
      );
    }

    await consumeIngredientsAndUpdateAvailability(client, items);

    let loyaltyAccount = null;
    if (customer_phone) {
      const earnedPoints = Math.floor(toNumber(discount.totalAmount) / 100) * LOYALTY_POINTS_PER_100_RUPEES;

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
         o.customer_email,
         o.special_notes,
         o.subtotal_amount,
         o.discount_amount,
         o.total_amount,
         o.promo_code,
         o.priority,
         o.status,
         o.prep_started_at,
         o.ready_at,
         o.prep_sla_minutes,
         o.created_at,
         oi.menu_item_id,
         oi.quantity,
         oi.item_price,
         m.name AS menu_item_name
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       LEFT JOIN menu_items m ON oi.menu_item_id = m.id
       WHERE o.status IN ('PENDING', 'IN_PROGRESS')
       ORDER BY
         CASE o.priority WHEN 'vip' THEN 1 WHEN 'urgent' THEN 2 WHEN 'bulk' THEN 3 ELSE 4 END,
         o.created_at ASC,
         oi.id ASC`
    );

    res.json(formatOrdersWithItems(result.rows));
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
         o.customer_email,
         o.special_notes,
         o.subtotal_amount,
         o.discount_amount,
         o.total_amount,
         o.promo_code,
         o.priority,
         o.status,
         o.prep_started_at,
         o.ready_at,
         o.prep_sla_minutes,
         o.created_at,
         oi.menu_item_id,
         oi.quantity,
         oi.item_price,
         m.name AS menu_item_name
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       LEFT JOIN menu_items m ON oi.menu_item_id = m.id
       WHERE o.status = 'READY'
       ORDER BY o.ready_at DESC NULLS LAST, o.created_at ASC, oi.id ASC`
    );

    res.json(formatOrdersWithItems(result.rows));
  } catch (error) {
    console.error("Error fetching ready orders:", error.message);
    res.status(500).json({ error: "Failed to fetch ready orders" });
  }
};

const buildOrderFilter = (query) => {
  const where = [];
  const params = [];

  if (query.status) {
    params.push(String(query.status).toUpperCase());
    where.push(`o.status = $${params.length}`);
  }

  if (query.phone) {
    params.push(`%${String(query.phone).trim()}%`);
    where.push(`COALESCE(o.customer_phone, '') ILIKE $${params.length}`);
  }

  if (query.token) {
    params.push(`%${String(query.token).trim()}%`);
    where.push(`COALESCE(o.token_number, '') ILIKE $${params.length}`);
  }

  if (query.from) {
    params.push(query.from);
    where.push(`o.created_at >= $${params.length}::timestamptz`);
  }

  if (query.to) {
    params.push(query.to);
    where.push(`o.created_at <= $${params.length}::timestamptz`);
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return { whereClause, params };
};

const getAllOrders = async (req, res) => {
  try {
    const { whereClause, params } = buildOrderFilter(req.query);

    const result = await pool.query(
      `SELECT
         o.*,
         FLOOR(o.total_amount / 100)::INT AS points_earned,
         CASE
           WHEN o.status = 'READY'
             AND o.prep_started_at IS NOT NULL
             AND EXTRACT(EPOCH FROM (o.ready_at - o.prep_started_at))/60 > o.prep_sla_minutes
           THEN TRUE
           ELSE FALSE
         END AS sla_breached
       FROM orders o
       ${whereClause}
       ORDER BY o.created_at DESC`,
      params
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching all orders:", error.message);
    res.status(500).json({ error: "Failed to fetch all orders" });
  }
};

const exportOrders = async (req, res) => {
  try {
    const format = String(req.query.format || "csv").toLowerCase();
    const { whereClause, params } = buildOrderFilter(req.query);

    const result = await pool.query(
      `SELECT
         o.token_number,
         o.customer_phone,
         o.customer_email,
         o.status,
         o.priority,
         o.subtotal_amount,
         o.discount_amount,
         o.total_amount,
         o.promo_code,
         o.created_at
       FROM orders o
       ${whereClause}
       ORDER BY o.created_at DESC`,
      params
    );

    if (format === "pdf") {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'attachment; filename="orders-report.pdf"');

      const doc = new PDFDocument({ margin: 40, size: "A4" });
      doc.pipe(res);

      doc.fontSize(16).text("Orders Report", { underline: true });
      doc.moveDown();

      result.rows.forEach((order) => {
        doc
          .fontSize(10)
          .text(
            `Token: ${order.token_number} | Status: ${order.status} | Priority: ${order.priority} | Total: ${order.total_amount} | Phone: ${order.customer_phone || "N/A"} | Date: ${new Date(order.created_at).toLocaleString()}`
          );
        doc.moveDown(0.4);
      });

      doc.end();
      return;
    }

    const headers = [
      "token_number",
      "customer_phone",
      "customer_email",
      "status",
      "priority",
      "subtotal_amount",
      "discount_amount",
      "total_amount",
      "promo_code",
      "created_at",
    ];

    const lines = [headers.join(",")];
    result.rows.forEach((row) => {
      lines.push(
        headers
          .map((key) => {
            const value = row[key] ?? "";
            const safeValue = String(value).replaceAll('"', '""');
            return `"${safeValue}"`;
          })
          .join(",")
      );
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="orders-report.csv"');
    res.send(lines.join("\n"));
  } catch (error) {
    console.error("Error exporting orders:", error.message);
    res.status(500).json({ error: "Failed to export orders" });
  }
};

const getSalesSummary = async (req, res) => {
  try {
    const from = req.query.from || null;
    const to = req.query.to || null;

    const dailyResult = await pool.query(
      `SELECT DATE(created_at) AS day,
              COUNT(*)::INT AS orders_count,
              COALESCE(SUM(total_amount), 0) AS sales_total
       FROM orders
       WHERE ($1::timestamptz IS NULL OR created_at >= $1::timestamptz)
         AND ($2::timestamptz IS NULL OR created_at <= $2::timestamptz)
       GROUP BY DATE(created_at)
       ORDER BY day DESC
       LIMIT 31`,
      [from, to]
    );

    const monthlyResult = await pool.query(
      `SELECT TO_CHAR(created_at, 'YYYY-MM') AS month,
              COUNT(*)::INT AS orders_count,
              COALESCE(SUM(total_amount), 0) AS sales_total
       FROM orders
       WHERE ($1::timestamptz IS NULL OR created_at >= $1::timestamptz)
         AND ($2::timestamptz IS NULL OR created_at <= $2::timestamptz)
       GROUP BY TO_CHAR(created_at, 'YYYY-MM')
       ORDER BY month DESC
       LIMIT 12`,
      [from, to]
    );

    res.json({
      daily: dailyResult.rows,
      monthly: monthlyResult.rows,
    });
  } catch (error) {
    console.error("Error fetching sales summary:", error.message);
    res.status(500).json({ error: "Failed to fetch sales summary" });
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
    const status = String(req.body.status || "").toUpperCase();

    if (!["IN_PROGRESS", "READY", "COMPLETED", "CANCELLED"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const current = await pool.query("SELECT * FROM orders WHERE id = $1", [id]);
    if (current.rows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const order = current.rows[0];

    // Allow cancellation only before an order becomes READY.
    if (status === "CANCELLED" && ["READY", "COMPLETED", "CANCELLED"].includes(order.status)) {
      return res.status(400).json({
        error: "Cannot cancel this order because it is already ready/completed or already cancelled.",
      });
    }

    let query = "UPDATE orders SET status = $1";
    const params = [status];

    if (status === "IN_PROGRESS") {
      query += ", prep_started_at = COALESCE(prep_started_at, NOW())";
    }

    if (status === "READY") {
      query += ", ready_at = NOW()";
    }

    if (status === "CANCELLED") {
      query += ", cancelled_at = NOW()";
    }

    query += " WHERE id = $2 RETURNING *";
    params.push(id);

    const result = await pool.query(query, params);
    const updatedOrder = result.rows[0];

    if (status === "READY") {
      await sendReadyNotification({
        orderId: updatedOrder.id,
        phone: updatedOrder.customer_phone,
        email: updatedOrder.customer_email,
        tokenNumber: updatedOrder.token_number,
      });
    }

    if (io) {
      io.emit("order_status_updated", updatedOrder);

      if (
        updatedOrder.status === "READY"
        && updatedOrder.prep_started_at
        && updatedOrder.ready_at
      ) {
        const prepMinutes = (
          (new Date(updatedOrder.ready_at).getTime() - new Date(updatedOrder.prep_started_at).getTime())
          / 60000
        );

        if (prepMinutes > Number(updatedOrder.prep_sla_minutes || 15)) {
          io.emit("order_sla_alert", {
            order_id: updatedOrder.id,
            token_number: updatedOrder.token_number,
            prep_minutes: prepMinutes,
            sla_minutes: updatedOrder.prep_sla_minutes,
          });
        }
      }
    }

    res.json(updatedOrder);
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
  getAllOrders,
  exportOrders,
  getSalesSummary,
  getCashierKitchenAssistMode,
  setCashierKitchenAssistMode,
  setSocketInstance,
};
