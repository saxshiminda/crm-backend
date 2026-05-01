import express from "express";
import { pool } from "../db.js";
import authMiddleware from "../middleware/auth.js";

const router = express.Router();

// Get all leads with pagination and search
router.get("/", authMiddleware, async (req, res) => {
  const { search = '', status = '', page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;

  try {
    let query = "SELECT * FROM leads WHERE 1=1";
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (source ILIKE $${params.length})`;
    }

    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    const countResult = await pool.query("SELECT COUNT(*) FROM leads");

    res.json({
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Create lead
router.post("/", authMiddleware, async (req, res) => {
  const { status, value, source } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO leads (status, value, source) VALUES ($1, $2, $3) RETURNING *",
      [status, value, source]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Update lead
router.put("/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { status, value, source } = req.body;
  try {
    const result = await pool.query(
      "UPDATE leads SET status = $1, value = $2, source = $3 WHERE id = $4 RETURNING *",
      [status, value, source, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Lead not found" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Delete lead
router.delete("/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM leads WHERE id = $1", [id]);
    res.json({ message: "Lead deleted" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
