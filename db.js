import pkg from "pg";
const { Pool } = pkg;

export const pool = new Pool({
  user: "crm_user",
  host: "localhost",
  database: "crm_db",
  password: "aragtxov",
  port: 5432,
});
