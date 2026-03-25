const pool = require("../config/db");

let io;

const allowedAudiences = ["all", "cashier", "kitchen", "display", "admin"];

const setSocketInstance = (socketIo) => {
  io = socketIo;
};

const getMessages = async (req, res) => {
  try {
    const audience = String(req.query.audience || "all").trim().toLowerCase();

    if (!allowedAudiences.includes(audience)) {
      return res.status(400).json({ error: "Invalid audience" });
    }

    const result = await pool.query(
      `SELECT id, content, audience, is_active, created_at
       FROM messages
       WHERE is_active = TRUE
         AND (audience = 'all' OR audience = $1)
       ORDER BY created_at DESC
       LIMIT 50`,
      [audience]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching messages:", error.message);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
};

const createMessage = async (req, res) => {
  try {
    const content = String(req.body.content || "").trim();
    const audience = String(req.body.audience || "all").trim().toLowerCase();

    if (!content) {
      return res.status(400).json({ error: "content is required" });
    }

    if (!allowedAudiences.includes(audience)) {
      return res.status(400).json({ error: "Invalid audience" });
    }

    const result = await pool.query(
      `INSERT INTO messages (content, audience)
       VALUES ($1, $2)
       RETURNING id, content, audience, is_active, created_at`,
      [content, audience]
    );

    const createdMessage = result.rows[0];

    if (io) {
      io.emit("message_created", createdMessage);
    }

    res.status(201).json(createdMessage);
  } catch (error) {
    console.error("Error creating message:", error.message);
    res.status(500).json({ error: "Failed to create message" });
  }
};

const archiveMessage = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE messages
       SET is_active = FALSE
       WHERE id = $1
       RETURNING id, content, audience, is_active, created_at`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Message not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error archiving message:", error.message);
    res.status(500).json({ error: "Failed to archive message" });
  }
};

module.exports = {
  getMessages,
  createMessage,
  archiveMessage,
  setSocketInstance,
};
