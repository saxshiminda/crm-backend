import express from "express";
import { pool } from "../db.js";
import authMiddleware from "../middleware/auth.js";

const router = express.Router();

/**
 * @swagger
 * /api/reports/sales:
 *   get:
 *     summary: Get sales report data
 *     description: Summary metrics, monthly breakdown, and recent sales for the sales report page.
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sales report payload
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 summary:
 *                   type: object
 *                   properties:
 *                     total_sales: { type: integer }
 *                     total_revenue: { type: number }
 *                     avg_sale: { type: number }
 *                     largest_sale: { type: number }
 *                 monthly:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       month: { type: string }
 *                       sort_key: { type: string }
 *                       total: { type: number }
 *                       count: { type: integer }
 *                 recent:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: integer }
 *                       amount: { type: number }
 *                       sale_date: { type: string, format: date }
 *       401:
 *         description: Unauthorized
 */
router.get("/sales", authMiddleware, async (req, res) => {
  try {
    const summaryResult = await pool.query(`
      SELECT
        COUNT(*)::int AS total_sales,
        COALESCE(SUM(amount), 0) AS total_revenue,
        COALESCE(AVG(amount), 0) AS avg_sale,
        COALESCE(MAX(amount), 0) AS largest_sale
      FROM sales
    `);

    const monthlyResult = await pool.query(`
      SELECT
        TO_CHAR(sale_date, 'Mon') AS month,
        TO_CHAR(sale_date, 'YYYY-MM') AS sort_key,
        SUM(amount) AS total,
        COUNT(*)::int AS count
      FROM sales
      WHERE sale_date > CURRENT_DATE - INTERVAL '12 months'
      GROUP BY month, sort_key
      ORDER BY sort_key
    `);

    const recentResult = await pool.query(`
      SELECT id, amount, sale_date
      FROM sales
      ORDER BY sale_date DESC, id DESC
      LIMIT 25
    `);

    res.json({
      summary: summaryResult.rows[0],
      monthly: monthlyResult.rows,
      recent: recentResult.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * @swagger
 * /api/reports/users:
 *   get:
 *     summary: Get user report data
 *     description: User list, role breakdown, and summary counts for the user report page.
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User report payload
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 summary:
 *                   type: object
 *                   properties:
 *                     total_users: { type: integer }
 *                     admin_count: { type: integer }
 *                     manager_count: { type: integer }
 *                     user_count: { type: integer }
 *                 roleStats:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       role: { type: string }
 *                       count: { type: integer }
 *                 users:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 */
router.get("/users", authMiddleware, async (req, res) => {
  try {
    const usersResult = await pool.query(`
      SELECT id, name, email, phone, role, avatar, created_at
      FROM users
      ORDER BY created_at DESC
    `);

    const roleStats = await pool.query(`
      SELECT role, COUNT(*)::int AS count
      FROM users
      GROUP BY role
      ORDER BY count DESC
    `);

    const summaryResult = await pool.query(`
      SELECT
        COUNT(*)::int AS total_users,
        COUNT(*) FILTER (WHERE role = 'Admin')::int AS admin_count,
        COUNT(*) FILTER (WHERE role = 'Manager')::int AS manager_count,
        COUNT(*) FILTER (WHERE role = 'User')::int AS user_count
      FROM users
    `);

    res.json({
      summary: summaryResult.rows[0],
      roleStats: roleStats.rows,
      users: usersResult.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
