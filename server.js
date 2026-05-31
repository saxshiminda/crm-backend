import "dotenv/config";
import express from "express";
import cors from "cors";
import { pool } from "./db.js";
import authRoutes from "./routes/auth.js";
import authMiddleware from "./middleware/auth.js";
import dashboardRoutes from "./routes/dashboard.js";
import leadRoutes from "./routes/leads.js";
import userRoutes from "./routes/users.js";
import reportRoutes from "./routes/reports.js";
import messageRoutes from "./routes/messages.js";

import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './swagger.js';

const app = express();

// Middlewares
app.use(express.json());
app.use(cors({ origin: "http://localhost:4200", credentials: true }));
app.use('/uploads', express.static('uploads'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));



// Routes
app.use("/api", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/users", userRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/messages", messageRoutes);

/**
 * @swagger
 * /api/protected:
 *   get:
 *     summary: Get current authenticated user
 *     description: Returns the logged-in user's profile. Used by the frontend after login.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: This is a protected route
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
app.get("/api/protected", authMiddleware, async (req, res) => {
    try {
        const result = await pool.query("SELECT id, name as username, email, phone, role, avatar FROM users WHERE id = $1", [req.user.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }
        console.log("Protected route fetching user:", result.rows[0]);
        res.json({ message: "This is a protected route", user: result.rows[0] });
    } catch (err) {
        console.error("Error fetching user:", err);
        res.status(500).json({ error: "Server error" });
    }
});

app.get("/", (req, res) => res.send(" is working 🚀"));

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
