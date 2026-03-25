const bcrypt = require("bcryptjs");
const pool = require("../config/db");

const allowedRoles = ["admin", "cashier", "kitchen", "display"];

const listUsers = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, role, is_active, created_at
       FROM app_users
       ORDER BY created_at DESC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error listing users:", error.message);
    res.status(500).json({ error: "Failed to list users" });
  }
};

const createUser = async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "").trim();
    const role = String(req.body.role || "").trim().toLowerCase();

    if (!username || !password || !allowedRoles.includes(role)) {
      return res.status(400).json({ error: "Invalid user payload" });
    }

    const hash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO app_users (username, password_hash, role)
       VALUES ($1, $2, $3)
       RETURNING id, username, role, is_active, created_at`,
      [username, hash, role]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating user:", error.message);
    res.status(500).json({ error: "Failed to create user" });
  }
};

const updateUser = async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const role = req.body.role ? String(req.body.role).trim().toLowerCase() : null;
    const isActive = req.body.is_active;

    if (!userId) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    if (role && !allowedRoles.includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    if (typeof isActive !== "undefined" && typeof isActive !== "boolean") {
      return res.status(400).json({ error: "is_active must be boolean" });
    }

    const result = await pool.query(
      `UPDATE app_users
       SET role = COALESCE($1, role),
           is_active = COALESCE($2, is_active)
       WHERE id = $3
       RETURNING id, username, role, is_active, created_at`,
      [role, typeof isActive === "boolean" ? isActive : null, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating user:", error.message);
    res.status(500).json({ error: "Failed to update user" });
  }
};

const resetUserPassword = async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const newPassword = String(req.body.new_password || "").trim();

    if (!userId || !newPassword) {
      return res.status(400).json({ error: "Invalid password reset payload" });
    }

    const hash = await bcrypt.hash(newPassword, 10);

    const result = await pool.query(
      `UPDATE app_users
       SET password_hash = $1
       WHERE id = $2
       RETURNING id, username, role, is_active, created_at`,
      [hash, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Error resetting user password:", error.message);
    res.status(500).json({ error: "Failed to reset password" });
  }
};

module.exports = {
  listUsers,
  createUser,
  updateUser,
  resetUserPassword,
};
