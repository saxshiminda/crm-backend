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

      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        sender_name VARCHAR(255) NOT NULL,
        sender_email VARCHAR(255),
        subject VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      DROP TABLE IF EXISTS chat_messages;
      DROP TABLE IF EXISTS conversations;

      CREATE TABLE conversations (
        id SERIAL PRIMARY KEY,
        user1_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        user2_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user1_id, user2_id),
        CHECK (user1_id < user2_id)
      );

      CREATE TABLE chat_messages (
        id SERIAL PRIMARY KEY,
        conversation_id INT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        sender_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        body TEXT NOT NULL,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar VARCHAR(255);
    `);

    // 2. Add Users
    const adminPassword = await bcrypt.hash("admin123", 10);
    const userPassword = await bcrypt.hash("password123", 10);
    await client.query(`
      INSERT INTO users (name, email, password, role, phone)
      VALUES
        ('Admin User', 'admin@crm.com', $1, 'Admin', '+1 (555) 100-0001'),
        ('Sarah Chen', 'sarah@crm.com', $2, 'Manager', '+1 (555) 100-0002'),
        ('Marcus Webb', 'marcus@crm.com', $2, 'Manager', '+1 (555) 100-0003'),
        ('Elena Rodriguez', 'elena@crm.com', $2, 'User', '+1 (555) 100-0004'),
        ('James Okonkwo', 'james@crm.com', $2, 'User', '+1 (555) 100-0005'),
        ('Priya Sharma', 'priya@crm.com', $2, 'User', '+1 (555) 100-0006')
      ON CONFLICT (email) DO NOTHING;
    `, [adminPassword, userPassword]);

    // 3. Clear old data for seeding
    await client.query("DELETE FROM chat_messages; DELETE FROM conversations; DELETE FROM messages; DELETE FROM leads; DELETE FROM sales; DELETE FROM tasks;");

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

    // 7. Seed Chat Messages
    const userRows = await client.query("SELECT id, name FROM users ORDER BY id");
    const usersByName = Object.fromEntries(userRows.rows.map(u => [u.name, u.id]));

    async function seedConversation(nameA, nameB, messages) {
      const idA = usersByName[nameA];
      const idB = usersByName[nameB];
      if (!idA || !idB) return;
      const [user1_id, user2_id] = idA < idB ? [idA, idB] : [idB, idA];
      const conv = await client.query(
        "INSERT INTO conversations (user1_id, user2_id) VALUES ($1, $2) RETURNING id",
        [user1_id, user2_id]
      );
      const conversationId = conv.rows[0].id;
      for (const msg of messages) {
        const senderId = usersByName[msg.from];
        const date = new Date();
        date.setMinutes(date.getMinutes() - msg.minutesAgo);
        await client.query(
          "INSERT INTO chat_messages (conversation_id, sender_id, body, is_read, created_at) VALUES ($1, $2, $3, $4, $5)",
          [conversationId, senderId, msg.body, msg.is_read ?? false, date]
        );
      }
    }

    await seedConversation('Admin User', 'Sarah Chen', [
      { from: 'Sarah Chen', body: 'Hey! Can we review the Q2 pipeline together?', is_read: false, minutesAgo: 30 },
      { from: 'Admin User', body: 'Sure, let me pull up the dashboard.', is_read: true, minutesAgo: 25 },
      { from: 'Sarah Chen', body: 'I flagged three qualified leads that need follow-up this week.', is_read: false, minutesAgo: 20 },
    ]);

    await seedConversation('Admin User', 'Marcus Webb', [
      { from: 'Marcus Webb', body: 'Just added a high-value referral from Acme Corp — $12,500.', is_read: false, minutesAgo: 120 },
      { from: 'Admin User', body: 'Nice work. Assign it to Elena.', is_read: true, minutesAgo: 115 },
    ]);

    await seedConversation('Admin User', 'Elena Rodriguez', [
      { from: 'Elena Rodriguez', body: 'TechFlow Inc signed! Updated the lead to Closed.', is_read: true, minutesAgo: 300 },
      { from: 'Admin User', body: 'Congratulations! Great close.', is_read: true, minutesAgo: 290 },
    ]);

    await seedConversation('Sarah Chen', 'Marcus Webb', [
      { from: 'Marcus Webb', body: 'Are you free for a quick sync on the referral pipeline?', is_read: true, minutesAgo: 60 },
      { from: 'Sarah Chen', body: 'Yes, 2pm works for me.', is_read: true, minutesAgo: 55 },
    ]);

    console.log("✅ Seeding completed successfully!");
  } catch (err) {
    console.error("❌ Seeding failed:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
