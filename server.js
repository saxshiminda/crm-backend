import "dotenv/config";
import express from "express";
import cors from "cors";
import { pool } from "./db.js";
import authRoutes from "./routes/auth.js";
import authMiddleware from "./middleware/auth.js";
import dashboardRoutes from "./routes/dashboard.js";

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
