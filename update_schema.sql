-- Run this query in your database tool (e.g., for crm-db) to add the missing columns

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS phone VARCHAR(255),
ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'User',
ADD COLUMN IF NOT EXISTS avatar VARCHAR(255);
