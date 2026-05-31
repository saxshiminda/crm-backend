import express from "express";
import { pool } from "../db.js";
import authMiddleware from "../middleware/auth.js";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = express.Router();

// Configure multer for avatar uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/avatars';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed!'));
  }
});

// Update profile
router.put("/profile", authMiddleware, async (req, res) => {
  const { name, phone } = req.body;
  try {
    const result = await pool.query(
      "UPDATE users SET name = $1, phone = $2 WHERE id = $3 RETURNING id, name, email, phone, role, avatar",
      [name, phone, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Upload avatar
router.post("/avatar", authMiddleware, upload.single('avatar'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  
  const avatarPath = `/uploads/avatars/${req.file.filename}`;
  try {
    await pool.query("UPDATE users SET avatar = $1 WHERE id = $2", [avatarPath, req.user.id]);
    res.json({ avatar: avatarPath });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Change password
router.put("/password", authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Current and new password are required" });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: "New password must be at least 6 characters" });
  }

  try {
    const userResult = await pool.query("SELECT password FROM users WHERE id = $1", [req.user.id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const bcrypt = (await import("bcrypt")).default;
    const match = await bcrypt.compare(currentPassword, userResult.rows[0].password);
    if (!match) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query("UPDATE users SET password = $1 WHERE id = $2", [hashed, req.user.id]);

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
