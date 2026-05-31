import express from "express";
import { pool } from "../db.js";
import authMiddleware from "../middleware/auth.js";

const router = express.Router();

router.get("/", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, sender_name, sender_email, subject, body, is_read, created_at
      FROM messages
      ORDER BY created_at DESC
    `);

    const unreadResult = await pool.query(
      "SELECT COUNT(*)::int AS unread FROM messages WHERE is_read = false"
    );

    res.json({
      messages: result.rows,
      unread: unreadResult.rows[0].unread
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/:id/read", authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "UPDATE messages SET is_read = true WHERE id = $1 RETURNING *",
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Message not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/read-all", authMiddleware, async (_req, res) => {
  try {
    await pool.query("UPDATE messages SET is_read = true WHERE is_read = false");
    res.json({ message: "All messages marked as read" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
