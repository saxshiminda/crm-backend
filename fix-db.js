import "dotenv/config";
import { pool } from "./db.js";

async function fixDatabase() {
    try {
        console.log("Checking 'users' table schema...");

        const res = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users';
    `);

        const existingColumns = res.rows.map(r => r.column_name);
        console.log("Current columns:", existingColumns);

        const columnsToAdd = ['phone', 'avatar'];

        for (const col of columnsToAdd) {
            if (!existingColumns.includes(col)) {
                console.log(`Adding missing column: ${col}`);
                await pool.query(`ALTER TABLE users ADD COLUMN ${col} VARCHAR(255);`);
            } else {
                console.log(`Column '${col}' already exists.`);
            }
        }

        console.log("Database fix completed.");
        process.exit(0);
    } catch (err) {
        console.error("Error fixing database:", err);
        process.exit(1);
    }
}

fixDatabase();
