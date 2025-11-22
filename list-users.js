import "dotenv/config";
import { pool } from "./db.js";

async function listUsers() {
    try {
        const res = await pool.query('SELECT * FROM users');
        console.log("Users in crm_db:", res.rows);
        process.exit(0);
    } catch (err) {
        console.error("Error listing users:", err);
        process.exit(1);
    }
}

listUsers();
