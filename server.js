import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";

const app = express();

// Middlewares
app.use(express.json());
app.use(cors({ origin: "http://localhost:4200", credentials: true }));

// Routes
app.use("/api", authRoutes);

app.get("/", (req, res) => res.send(" is working 🚀"));

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
