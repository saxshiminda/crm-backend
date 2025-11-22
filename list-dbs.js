import "dotenv/config";
import { pool } from "./db.js";

async function listDatabases() {
    try {
        const res = await pool.query(`
      SELECT datname FROM pg_database
      WHERE datistemplate = false;
    `);
        console.log("Databases:", res.rows.map(r => r.datname));
        process.exit(0);
    } catch (err) {
        console.error("Error listing databases:", err);
        process.exit(1);
    }
}

listDatabases();
