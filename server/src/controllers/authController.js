const bcrypt = require("bcryptjs");
const pool = require("../config/db");
const { signToken } = require("../services/jwtService");

const login = async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "").trim();

    if (!username || !password) {
      return res.status(400).json({ error: "username and password are required" });
    }

    const userResult = await pool.query(
      `SELECT id, username, password_hash, role, is_active
       FROM app_users
       WHERE username = $1`,
      [username]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = userResult.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ error: "User account is disabled" });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = signToken({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Error logging in:", error.message);
    res.status(500).json({ error: "Failed to login" });
  }
};

module.exports = {
  login,
};
