import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../db.js";

const router = Router();
const JWT_SECRET = "your_super_secret";

// Login route
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query("SELECT * FROM users WHERE name=$1", [username]);
    if (result.rows.length === 0) return res.status(401).json({ error: "Invalid username" });

    const user = result.rows[0];

    // Compare input password with hashed password column
    const match = await bcrypt.compare(password, user.password);
    
    if (!match) return res.status(401).json({ error: "Incorect password" });

    // Include name in JWT
    const token = jwt.sign({ id: user.id, username: user.name }, JWT_SECRET, { expiresIn: "1h" });

    res.json({ token });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});


export default router;
