import "dotenv/config";
import pkg from "pg";
const { Pool } = pkg;
import bcrypt from "bcryptjs";

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function seed() {
  const client = await pool.connect();
  try {
    console.log("🌱 Starting seeding...");

    // 1. Create Tables & Ensure Constraints
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        phone VARCHAR(255),
        role VARCHAR(50) DEFAULT 'User',
        avatar VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Ensure email is unique if table already existed
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_email_key') THEN
          ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS leads (
        id SERIAL PRIMARY KEY,
        status VARCHAR(50) NOT NULL,
        value DECIMAL(10,2),
        source VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sales (
        id SERIAL PRIMARY KEY,
        amount DECIMAL(10,2) NOT NULL,
        sale_date DATE NOT NULL,
        customer_id INT
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'Pending',
        priority VARCHAR(50) DEFAULT 'Medium',
        due_date DATE
      );
    `);

    // 2. Add Admin User
    const adminPassword = await bcrypt.hash("admin123", 10);
    await client.query(`
      INSERT INTO users (name, email, password, role)
      VALUES ('Admin User', 'admin@crm.com', $1, 'Admin')
      ON CONFLICT (email) DO NOTHING;
    `, [adminPassword]);

    // 3. Clear old data for seeding
    await client.query("DELETE FROM leads; DELETE FROM sales; DELETE FROM tasks;");

    // 4. Seed Leads
    const leadStatuses = ['New', 'Contacted', 'Qualified', 'Lost', 'Closed'];
    const leadSources = ['Web', 'Referral', 'Social Media', 'Cold Call', 'Ad'];
    for (let i = 0; i < 100; i++) {
      const status = leadStatuses[Math.floor(Math.random() * leadStatuses.length)];
      const source = leadSources[Math.floor(Math.random() * leadSources.length)];
      const value = (Math.random() * 5000 + 500).toFixed(2);
      const date = new Date();
      date.setMonth(date.getMonth() - Math.floor(Math.random() * 6));
      await client.query("INSERT INTO leads (status, value, source, created_at) VALUES ($1, $2, $3, $4)", [status, value, source, date]);
    }

    // 5. Seed Sales (Last 12 months)
    for (let i = 0; i < 12; i++) {
      const monthDate = new Date();
      monthDate.setMonth(monthDate.getMonth() - i);
      const salesCount = Math.floor(Math.random() * 10 + 5);
      for (let j = 0; j < salesCount; j++) {
        const amount = (Math.random() * 2000 + 100).toFixed(2);
        await client.query("INSERT INTO sales (amount, sale_date) VALUES ($1, $2)", [amount, monthDate]);
      }
    }

    // 6. Seed Tasks
    const taskPriorities = ['Low', 'Medium', 'High'];
    const taskStatuses = ['Pending', 'In Progress', 'Completed'];
    for (let i = 0; i < 20; i++) {
      const title = `Task ${i + 1}`;
      const status = taskStatuses[Math.floor(Math.random() * taskStatuses.length)];
      const priority = taskPriorities[Math.floor(Math.random() * taskPriorities.length)];
      await client.query("INSERT INTO tasks (title, status, priority, due_date) VALUES ($1, $2, $3, CURRENT_DATE)", [title, status, priority]);
    }

    console.log("✅ Seeding completed successfully!");
  } catch (err) {
    console.error("❌ Seeding failed:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
