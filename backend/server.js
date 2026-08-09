// server.js
const express = require('express');
const cors = require('cors');
const { initializeDatabase, query } = require('./db');
const { fetchProductByBarcode, searchProducts, findSafeAlternatives } = require('./foodApi');
const { analyzeProduct } = require('./matcher');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Database Tables on Startup
initializeDatabase();

// ----------------------------------------------------
// Express Routes
// ----------------------------------------------------

/**
 * Health Check
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

/**
 * Fetch default User Profile settings (User ID = 1)
 */
app.get('/api/profile', async (req, res) => {
  try {
    const result = await query('SELECT * FROM profiles WHERE user_id = 1');
    if (result.rows.length === 0) {
      // Return empty default profile
      return res.json({ user_id: 1, allergies: [], diets: [], conditions: [], goals: [] });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile.' });
  }
});

/**
 * Update default User Profile settings (User ID = 1)
 */
app.post('/api/profile', async (req, res) => {
  const { allergies = [], diets = [], conditions = [], goals = [] } = req.body;
  try {
    // Ensure default user exists
    await query('INSERT INTO users (id, username) VALUES (1, \'default_user\') ON CONFLICT (id) DO NOTHING');
    
    // Upsert profile
    const result = await query(
      `INSERT INTO profiles (user_id, allergies, diets, conditions, goals)
       VALUES (1, $1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE 
       SET allergies = EXCLUDED.allergies, diets = EXCLUDED.diets, conditions = EXCLUDED.conditions, goals = EXCLUDED.goals
       RETURNING *`,
      [allergies, diets, conditions, goals]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error saving profile:', error);
    res.status(500).json({ error: 'Failed to update user profile.' });
  }
});

/**
 * Analyze Product Endpoint
 * Accepts:
 *  - barcode (string) OR
 *  - ocr_text (string) + optional product_name (string)
 */
app.post('/api/analyze', async (req, res) => {
  const { barcode, ocr_text, product_name } = req.body;

  try {
    // Fetch active user profile
    let profile = { allergies: [], diets: [], conditions: [], goals: [] };
    const profileRes = await query('SELECT * FROM profiles WHERE user_id = 1');
    if (profileRes.rows.length > 0) {
      profile = profileRes.rows[0];
    }

    let product = null;
    let alternatives = [];

    // Case 1: Barcode Scan / Search
    if (barcode) {
      product = await fetchProductByBarcode(barcode);
      if (!product) {
        return res.status(404).json({ error: 'Product not found in Open Food Facts database.' });
      }

      // Analyze product
      const evaluation = analyzeProduct(product, profile);

      // Save to Scan History
      await query(
        'INSERT INTO scans (user_id, product_code, product_name, safety_status) VALUES (1, $1, $2, $3)',
        [product.code, product.product_name, evaluation.safety_status]
      );

      // Find alternatives if the product is flagged as unsafe
      if (evaluation.safety_status === 'danger') {
        alternatives = await findSafeAlternatives(product.categories_tags, profile, product.code);
      }

      return res.json({
        product,
        evaluation,
        alternatives
      });
    }

    // Case 2: OCR Raw Label Text
    if (ocr_text) {
      const name = product_name || 'OCR Scanned Label';
      product = {
        code: 'ocr_' + Date.now(),
        product_name: name,
        brands: 'Custom Source',
        image_front_url: '',
        ingredients_text: ocr_text,
        categories_tags: [],
        categories: 'Custom',
        nutriscore_grade: 'unknown',
        nutriments: {}
      };

      const evaluation = analyzeProduct(product, profile);

      // Save to Scan History
      await query(
        'INSERT INTO scans (user_id, product_code, product_name, safety_status) VALUES (1, $1, $2, $3)',
        [product.code, product.product_name, evaluation.safety_status]
      );

      return res.json({
        product,
        evaluation,
        alternatives: [] // No alternatives for raw OCR texts as we don't have categories
      });
    }

    return res.status(400).json({ error: 'Provide either a barcode or ocr_text to analyze.' });

  } catch (error) {
    console.error('Error analyzing product:', error);
    res.status(500).json({ error: 'An error occurred during analysis.' });
  }
});

/**
 * Text search endpoint
 */
app.get('/api/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Provide a query term ?q=...' });
  try {
    const results = await searchProducts(q);
    res.json(results);
  } catch (error) {
    console.error('Error searching products:', error);
    res.status(500).json({ error: 'Failed to search products.' });
  }
});

/**
 * Fetch Scan History (User ID = 1)
 */
app.get('/api/history', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM scans WHERE user_id = 1 ORDER BY scanned_at DESC LIMIT 20'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Failed to retrieve scan history.' });
  }
});

/**
 * Fetch Saved/Favorite Products (User ID = 1)
 */
app.get('/api/favorites', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM favorites WHERE user_id = 1 ORDER BY product_name ASC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({ error: 'Failed to retrieve favorites.' });
  }
});

/**
 * Add product to favorites
 */
app.post('/api/favorites', async (req, res) => {
  const { product_code, product_name, image_url } = req.body;
  if (!product_code || !product_name) {
    return res.status(400).json({ error: 'Provide product_code and product_name.' });
  }
  try {
    await query(
      `INSERT INTO favorites (user_id, product_code, product_name, image_url)
       VALUES (1, $1, $2, $3)
       ON CONFLICT (user_id, product_code) DO NOTHING`,
      [product_code, product_name, image_url]
    );
    res.json({ success: true, message: 'Added to favorites.' });
  } catch (error) {
    console.error('Error adding favorite:', error);
    res.status(500).json({ error: 'Failed to save favorite.' });
  }
});

/**
 * Remove product from favorites
 */
app.delete('/api/favorites/:code', async (req, res) => {
  const { code } = req.params;
  try {
    await query(
      'DELETE FROM favorites WHERE user_id = 1 AND product_code = $1',
      [code]
    );
    res.json({ success: true, message: 'Removed from favorites.' });
  } catch (error) {
    console.error('Error removing favorite:', error);
    res.status(500).json({ error: 'Failed to delete favorite.' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`NutriGuard Backend server listening on port ${PORT}`);
});
