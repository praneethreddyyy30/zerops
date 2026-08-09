// db.js
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Setup DB connection configuration
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || process.env.DB_PASS || 'postgres',
  database: process.env.DB_NAME || 'nutriguard',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

let useInMemoryFallback = false;

// Simple In-Memory Mock Store with pre-populated history for local testing
const inMemoryStore = {
  profiles: [
    {
      user_id: 1,
      allergies: [],
      diets: [],
      conditions: [],
      goals: []
    }
  ],
  // Pre-populated history so scan log is never empty on test startup
  scan_history: [
    {
      id: 1,
      user_id: 1,
      product_code: '049000028904',
      product_name: 'Coca-Cola Classic',
      safety_status: 'danger',
      scanned_at: new Date(Date.now() - 3600000 * 2) // 2 hours ago
    },
    {
      id: 2,
      user_id: 1,
      product_code: '030000010206',
      product_name: 'Quaker Quick 1-Minute Oats',
      safety_status: 'safe',
      scanned_at: new Date(Date.now() - 3600000) // 1 hour ago
    }
  ],
  favorites: [
    {
      user_id: 1,
      product_code: '030000010206',
      product_name: 'Quaker Quick 1-Minute Oats',
      image_url: 'https://images.openfoodfacts.org/images/products/003/000/001/0206/front_en.12.400.jpg'
    }
  ]
};

/**
 * Automatically creates database tables if they do not exist.
 */
async function initializeDatabase() {
  try {
    const sqlPath = path.join(__dirname, 'database.sql');
    if (fs.existsSync(sqlPath)) {
      const sql = fs.readFileSync(sqlPath, 'utf8');
      // Verify connection by running a query
      await pool.query('SELECT 1');
      await pool.query(sql);
      console.log('Database tables successfully initialized.');
    } else {
      console.warn('database.sql file not found. Skipping table auto-creation.');
    }
  } catch (error) {
    console.error('Failed to initialize database tables, switching to in-memory mock store:', error.message);
    useInMemoryFallback = true;
  }
}

/**
 * Run resilient queries with fallback to in-memory store if connection fails
 */
async function query(text, params) {
  if (useInMemoryFallback) {
    return runInMemoryQuery(text, params);
  }
  try {
    return await pool.query(text, params);
  } catch (err) {
    console.warn('Database query failed, falling back to in-memory store:', err.message);
    useInMemoryFallback = true;
    return runInMemoryQuery(text, params);
  }
}

/**
 * Executes a simulated SQL query against the in-memory JavaScript store
 */
function runInMemoryQuery(text, params) {
  const queryClean = text.replace(/\s+/g, ' ').trim().toLowerCase();
  
  // 1. Fetch Profile
  if (queryClean.includes('select * from profiles where user_id =')) {
    return { rows: [inMemoryStore.profiles[0]] };
  }
  
  // 2. Insert/Update Profile
  if (queryClean.includes('insert into profiles') || queryClean.includes('update profiles')) {
    if (params && params.length >= 5) {
      const [user_id, allergies, diets, conditions, goals] = params;
      inMemoryStore.profiles[0] = { user_id, allergies, diets, conditions, goals };
    } else if (params && params.length === 4) {
      const [allergies, diets, conditions, goals] = params;
      inMemoryStore.profiles[0] = { user_id: 1, allergies, diets, conditions, goals };
    }
    return { rows: [inMemoryStore.profiles[0]] };
  }
  
  // 3. Fetch History (mapping "scans" queries to in-memory scan_history)
  if (queryClean.includes('select * from scans')) {
    const sortedHistory = [...inMemoryStore.scan_history].reverse();
    return { rows: sortedHistory };
  }
  
  // 4. Log Scan History (mapping "scans" insertion to in-memory scan_history)
  if (queryClean.includes('insert into scans')) {
    const [product_code, product_name, safety_status] = params;
    const newLog = {
      id: inMemoryStore.scan_history.length + 1,
      user_id: 1,
      product_code,
      product_name,
      safety_status,
      scanned_at: new Date()
    };
    inMemoryStore.scan_history.push(newLog);
    return { rows: [newLog] };
  }
  
  // 5. Fetch Favorites
  if (queryClean.includes('select * from favorites')) {
    return { rows: inMemoryStore.favorites };
  }
  
  // 6. Add Favorite
  if (queryClean.includes('insert into favorites')) {
    const [user_id, product_code, product_name, image_url] = params;
    if (!inMemoryStore.favorites.some(f => f.product_code === product_code)) {
      const newFav = { user_id, product_code, product_name, image_url };
      inMemoryStore.favorites.push(newFav);
    }
    return { rows: [] };
  }
  
  // 7. Delete Favorite
  if (queryClean.includes('delete from favorites where product_code =')) {
    const product_code = params[1] || params[0]; // handles different param structures
    inMemoryStore.favorites = inMemoryStore.favorites.filter(f => f.product_code !== product_code);
    return { rows: [] };
  }

  return { rows: [] };
}

module.exports = {
  query,
  pool,
  initializeDatabase
};
