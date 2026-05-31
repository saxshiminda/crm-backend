import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../db.js";
import upload from "../middleware/upload.js";

const router = Router();

/**
 * @swagger
 * /api/login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Successful login
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *       401:
 *         description: Invalid credentials
 */
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
    const token = jwt.sign({ id: user.id, username: user.name }, process.env.JWT_SECRET, { expiresIn: "1h" });

    res.json({ token });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * @swagger
 * /api/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Auth]
 *     security: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
// Logout route (placeholder for future server-side invalidation if needed)
router.post("/logout", (req, res) => {
  res.json({ message: "Logged out successfully" });
});

/**
 * @swagger
 * /api/profile:
 *   post:
 *     summary: Update user profile (legacy multipart route)
 *     description: Legacy endpoint. Prefer PUT /api/users/profile for JSON updates.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [User, Manager, Admin]
 *               avatar:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       401:
 *         description: Unauthorized
 */
// Update profile route
router.post("/profile", upload.single('avatar'), async (req, res) => {
  console.log("Profile update request received:", req.body);
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;
    const { name, email, phone, role } = req.body;
    let avatar = req.file ? `/uploads/${req.file.filename}` : undefined;

    // Build dynamic query
    let query = "UPDATE users SET name = $1, email = $2, phone = $3, role = $4";
    let params = [name, email, phone, role];
    let paramIndex = 5;

    if (avatar) {
      query += `, avatar = $${paramIndex}`;
      params.push(avatar);
      paramIndex++;
    }

    query += ` WHERE id = $${paramIndex} RETURNING id, name, email, phone, role, avatar`;
    params.push(userId);

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "Profile updated successfully", user: result.rows[0] });
  } catch (err) {
    console.error("Profile update error:", err);
    res.status(500).json({ error: "Server error" });
  }
});


export default router;
