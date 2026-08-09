-- database.sql
-- Run this on your PostgreSQL instance to initialize the database tables for NutriGuard.

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Profiles Table
CREATE TABLE IF NOT EXISTS profiles (
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    allergies TEXT[] DEFAULT '{}',    -- Array of allergens to avoid (e.g., ['dairy', 'gluten'])
    diets TEXT[] DEFAULT '{}',        -- Array of diets (e.g., ['vegan'])
    conditions TEXT[] DEFAULT '{}',   -- Array of health conditions (e.g., ['diabetes'])
    goals TEXT[] DEFAULT '{}'         -- Array of fitness goals to target (e.g., ['high-protein'])
);

-- 3. Scans Table (History of scanned items)
CREATE TABLE IF NOT EXISTS scans (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    product_code VARCHAR(50) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    safety_status VARCHAR(20) NOT NULL, -- 'safe', 'warning', 'danger'
    scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Favorites Table (Pantry bookmarks)
CREATE TABLE IF NOT EXISTS favorites (
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    product_code VARCHAR(50) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    image_url TEXT,
    PRIMARY KEY (user_id, product_code)
);

-- Insert a default mock user for development
INSERT INTO users (id, username) 
VALUES (1, 'default_user')
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (user_id, allergies, diets, conditions, goals)
VALUES (1, '{}', '{}', '{}', '{}')
ON CONFLICT (user_id) DO NOTHING;
