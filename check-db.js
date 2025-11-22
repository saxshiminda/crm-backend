import { Pool } from "pg";

const pool = new Pool({
    user: "macbookair",
    host: "localhost",
    port: 5432,
    database: "crm_db"
});

async function checkColumns() {
    try {
        const tablesRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public';
    `);
        console.log("Tables in public schema:", tablesRes.rows.map(r => r.table_name));

        const res = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users';
    `);
        const columns = res.rows.map(r => r.column_name);
        console.log("Existing columns:", columns);

        const required = ['email', 'phone', 'role', 'avatar'];
        const missing = required.filter(c => !columns.includes(c));

        if (missing.length > 0) {
            console.log("Missing columns:", missing);
            // Add missing columns
            for (const col of missing) {
                console.log(`Adding column: ${col}`);
                await pool.query(`ALTER TABLE users ADD COLUMN ${col} VARCHAR(255);`);
            }
            console.log("All missing columns added successfully.");
        } else {
            console.log("All required columns exist.");
        }
        process.exit(0);
    } catch (err) {
        console.error("Error checking DB:", err);
        process.exit(1);
    }
}

checkColumns();
