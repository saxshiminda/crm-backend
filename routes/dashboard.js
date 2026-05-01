import express from "express";
import { pool } from "../db.js";
import authMiddleware from "../middleware/auth.js";

const router = express.Router();

router.get("/stats", authMiddleware, async (req, res) => {
  try {
    // 1. Leads by status
    const leadsByStatus = await pool.query(
      "SELECT status, COUNT(*) as count FROM leads GROUP BY status"
    );

    // 2. Sales last 6 months
    const monthlySales = await pool.query(`
      SELECT 
        TO_CHAR(sale_date, 'Mon') as month,
        SUM(amount) as total
      FROM sales
      WHERE sale_date > CURRENT_DATE - INTERVAL '6 months'
      GROUP BY month, TO_CHAR(sale_date, 'MM')
      ORDER BY TO_CHAR(sale_date, 'MM')
    `);

    // 3. Leads by source
    const leadsBySource = await pool.query(
      "SELECT source, COUNT(*) as count FROM leads GROUP BY source"
    );

    // 4. Tasks by priority
    const tasksByPriority = await pool.query(
      "SELECT priority, COUNT(*) as count FROM tasks GROUP BY priority"
    );

    // 5. Total counts
    const counts = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM leads) as total_leads,
        (SELECT SUM(amount) FROM sales) as total_revenue,
        (SELECT COUNT(*) FROM tasks WHERE status != 'Completed') as pending_tasks
    `);

    // 6. Recent activities
    const recentLeads = await pool.query(
      "SELECT status, value, created_at FROM leads ORDER BY created_at DESC LIMIT 5"
    );

    res.json({
      leadsByStatus: leadsByStatus.rows,
      monthlySales: monthlySales.rows,
      leadsBySource: leadsBySource.rows,
      tasksByPriority: tasksByPriority.rows,
      summary: counts.rows[0],
      recentLeads: recentLeads.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
