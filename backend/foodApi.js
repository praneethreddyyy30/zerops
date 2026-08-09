// foodApi.js
// Handles network queries to the public Open Food Facts API and finds safe alternatives.
// Equipped with robust mock fallbacks for testing and to prevent rate-limit 503 errors.

const http = require('http');
const https = require('https');
const { analyzeProduct } = require('./matcher');

const FALLBACK_PRODUCTS = {
  '028400199148': {
    code: '028400199148',
    product_name: 'Lay\'s Classic Potato Chips',
    brands: 'Lay\'s',
    image_front_url: 'https://images.openfoodfacts.org/images/products/002/840/019/9148/front_en.82.400.jpg',
    ingredients_text: 'POTATOES, VEGETABLE OIL (CANOLA, CORN, SOYBEAN AND/OR SUNFLOWER OIL), AND SALT',
    categories_tags: ['en:snacks', 'en:salty-snacks', 'en:chips-and-fries', 'en:crisps'],
    categories: 'Potato crisps',
    nutriscore_grade: 'd',
    nutriments: {
      proteins_100g: 7.1,
      carbohydrates_100g: 53.6,
      fiber_100g: 3.6,
      sodium_100g: 0.5,
      sugars_100g: 3.6,
      'energy-kcal_100g': 571
    }
  },
  '009800892204': {
    code: '009800892204',
    product_name: 'Nutella Hazelnut Spread',
    brands: 'Ferrero',
    image_front_url: 'https://images.openfoodfacts.org/images/products/009/800/892/204/front_en.112.400.jpg',
    ingredients_text: 'SUGAR, PALM OIL, HAZELNUTS, SKIM MILK, COCOA, LECITHIN (SOY), VANILLIN',
    categories_tags: ['en:spreads', 'en:sweet-spreads', 'en:hazelnut-spreads'],
    categories: 'Hazelnut spreads',
    nutriscore_grade: 'e',
    nutriments: {
      proteins_100g: 6.0,
      carbohydrates_100g: 57.0,
      fiber_100g: 3.4,
      sodium_100g: 0.04,
      sugars_100g: 54.0,
      'energy-kcal_100g': 539
    }
  },
  '009800800307': {
    code: '009800800307',
    product_name: 'Nutella Hazelnut Spread',
    brands: 'Ferrero',
    image_front_url: 'https://images.openfoodfacts.org/images/products/009/800/892/204/front_en.112.400.jpg',
    ingredients_text: 'SUGAR, PALM OIL, HAZELNUTS, SKIM MILK, COCOA, LECITHIN (SOY), VANILLIN',
    categories_tags: ['en:spreads', 'en:sweet-spreads', 'en:hazelnut-spreads'],
    categories: 'Hazelnut spreads',
    nutriscore_grade: 'e',
    nutriments: {
      proteins_100g: 6.0,
      carbohydrates_100g: 57.0,
      fiber_100g: 3.4,
      sodium_100g: 0.04,
      sugars_100g: 54.0,
      'energy-kcal_100g': 539
    }
  },
  '049000028904': {
    code: '049000028904',
    product_name: 'Coca-Cola Classic',
    brands: 'The Coca-Cola Company',
    image_front_url: 'https://images.openfoodfacts.org/images/products/004/900/002/8904/front_en.31.400.jpg',
    ingredients_text: 'CARBONATED WATER, HIGH FRUCTOSE CORN SYRUP, CARAMEL COLOR, PHOSPHORIC ACID, NATURAL FLAVORS, CAFFEINE',
    categories_tags: ['en:beverages', 'en:carbonated-drinks', 'en:sodas', 'en:colas'],
    categories: 'Colas',
    nutriscore_grade: 'e',
    nutriments: {
      proteins_100g: 0,
      carbohydrates_100g: 10.6,
      fiber_100g: 0,
      sodium_100g: 0.01,
      sugars_100g: 10.6,
      'energy-kcal_100g': 42
    }
  },
  '6111031005590': {
    code: '6111031005590',
    product_name: 'Oreo Chocolate Sandwich Cookies',
    brands: 'Nabisco',
    image_front_url: 'https://images.openfoodfacts.org/images/products/611/103/100/5590/front_en.6.400.jpg',
    ingredients_text: 'UNBLEACHED ENRICHED FLOUR (WHEAT FLOUR, NIACIN, REDUCED IRON, THIAMINE MONONITRATE, RIBOFLAVIN, FOLIC ACID), SUGAR, PALM AND/OR CANOLA OIL, COCOA (PROCESSED WITH ALKALI), HIGH FRUCTOSE CORN SYRUP, LEAVENING (BAKING SODA AND/OR CALCIUM PHOSPHATE), SALT, SOY LECITHIN, CHOCOLATE, ARTIFICIAL FLAVOR',
    categories_tags: ['en:snacks', 'en:sweet-snacks', 'en:biscuits-and-cakes', 'en:biscuits', 'en:chocolate-biscuits'],
    categories: 'Chocolate biscuits',
    nutriscore_grade: 'e',
    nutriments: {
      proteins_100g: 4.8,
      carbohydrates_100g: 69.0,
      fiber_100g: 2.4,
      sodium_100g: 0.38,
      sugars_100g: 38.0,
      'energy-kcal_100g': 476
    }
  },
  '030000010206': {
    code: '030000010206',
    product_name: 'Quaker Quick 1-Minute Oats',
    brands: 'Quaker',
    image_front_url: 'https://images.openfoodfacts.org/images/products/003/000/001/0206/front_en.12.400.jpg',
    ingredients_text: '100% WHOLE GRAIN QUAKER QUALITY ROLLED OATS',
    categories_tags: ['en:plant-based-foods-and-beverages', 'en:plant-based-foods', 'en:cereals-and-potatoes', 'en:cereals-and-their-products', 'en:breakfast-cereals', 'en:rolled-oats'],
    categories: 'Rolled oats',
    nutriscore_grade: 'a',
    nutriments: {
      proteins_100g: 12.5,
      carbohydrates_100g: 67.5,
      fiber_100g: 10.0,
      sodium_100g: 0,
      sugars_100g: 2.5,
      'energy-kcal_100g': 375
    }
  }
};

/**
 * Perform a clean GET request.
 */
function getJson(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, {
      headers: {
        'User-Agent': 'NutriGuard - WebApp - Version 1.1 - devteam@nutriguardapp.org'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Failed to parse JSON response: ' + e.message));
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Normalize Open Food Facts product structure.
 */
function normalizeProduct(raw) {
  if (!raw || !raw.product) return null;
  const p = raw.product;
  return {
    code: p.code || raw.code || '',
    product_name: p.product_name || p.product_name_en || 'Unknown Product',
    brands: p.brands || 'Generic Brand',
    image_front_url: p.image_front_url || p.image_url || '',
    ingredients_text: p.ingredients_text || p.ingredients_text_en || '',
    categories_tags: p.categories_tags || [],
    categories: p.categories || '',
    nutriscore_grade: p.nutriscore_grade || 'unknown',
    nutriments: {
      proteins_100g: parseFloat(p.nutriments?.proteins_100g ?? 0),
      carbohydrates_100g: parseFloat(p.nutriments?.carbohydrates_100g ?? 0),
      fiber_100g: parseFloat(p.nutriments?.fiber_100g ?? 0),
      sodium_100g: parseFloat(p.nutriments?.sodium_100g ?? 0),
      sugars_100g: parseFloat(p.nutriments?.sugars_100g ?? 0),
      'energy-kcal_100g': parseFloat(p.nutriments?.['energy-kcal_100g'] ?? p.nutriments?.['energy-kcal'] ?? 0)
    }
  };
}

/**
 * Fetch a product by its barcode.
 */
async function fetchProductByBarcode(barcode) {
  const cleanBarcode = barcode.trim();
  
  // Try Live query first
  const url = `https://world.openfoodfacts.org/api/v2/product/${cleanBarcode}.json`;
  try {
    const raw = await getJson(url);
    if (raw.status === 1 && raw.product) {
      return normalizeProduct(raw);
    }
  } catch (error) {
    console.error(`Live Open Food Facts query failed for barcode ${cleanBarcode}:`, error.message);
  }

  // Fallback to local test dictionary
  if (FALLBACK_PRODUCTS[cleanBarcode]) {
    console.log(`[INFO] Loaded fallback mock data for barcode: ${cleanBarcode}`);
    return FALLBACK_PRODUCTS[cleanBarcode];
  }

  return null;
}

/**
 * Search products by keyword terms.
 */
async function searchProducts(terms) {
  const cleanTerms = terms.trim();
  
  // If query is a numeric barcode, bypass search.pl and perform a direct barcode query
  if (/^\d{8,14}$/.test(cleanTerms)) {
    try {
      const product = await fetchProductByBarcode(cleanTerms);
      return product ? [product] : [];
    } catch (e) {
      return [];
    }
  }

  // Try live search
  const encodedTerms = encodeURIComponent(cleanTerms);
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodedTerms}&search_simple=1&action=process&json=true&page_size=24`;
  try {
    const raw = await getJson(url);
    if (raw.products && raw.products.length > 0) {
      return raw.products.map(p => normalizeProduct({ product: p, code: p.code }));
    }
  } catch (error) {
    console.error(`Live search failed for terms "${terms}":`, error.message);
  }

  // Fallback to searching our local mock dictionary
  const lowerTerms = cleanTerms.toLowerCase();
  const matchedFallbacks = Object.values(FALLBACK_PRODUCTS).filter(p => 
    p.product_name.toLowerCase().includes(lowerTerms) || 
    p.brands.toLowerCase().includes(lowerTerms) ||
    p.code.includes(lowerTerms)
  );

  return matchedFallbacks;
}

/**
 * Finds alternative products in the same category that meet the user's safety profiles.
 */
async function findSafeAlternatives(categoryTags, profile, currentBarcode) {
  if (!categoryTags || categoryTags.length === 0) return [];
  
  const targetCategory = categoryTags[categoryTags.length - 1];
  const url = `https://world.openfoodfacts.org/cgi/search.pl?action=process&tagtype_0=categories&tag_contains_0=contains&tag_0=${encodeURIComponent(targetCategory)}&json=true&page_size=15`;
  
  try {
    const raw = await getJson(url);
    if (raw.products && raw.products.length > 0) {
      const potentialAlternatives = raw.products
        .map(p => normalizeProduct({ product: p, code: p.code }))
        .filter(p => p && p.code !== currentBarcode);

      const safeAlternatives = [];
      for (const alt of potentialAlternatives) {
        const evaluation = analyzeProduct(alt, profile);
        if (evaluation.safety_status === 'safe') {
          safeAlternatives.push({ ...alt, evaluation });
        }
        if (safeAlternatives.length >= 3) break;
      }
      return safeAlternatives;
    }
  } catch (error) {
    console.error(`Live search for alternatives failed:`, error.message);
  }

  // Fallback alternatives from local mock database
  const safeAlternatives = [];
  const potentialAlternatives = Object.values(FALLBACK_PRODUCTS).filter(p => p.code !== currentBarcode);
  for (const alt of potentialAlternatives) {
    const evaluation = analyzeProduct(alt, profile);
    if (evaluation.safety_status === 'safe') {
      safeAlternatives.push({ ...alt, evaluation });
    }
    if (safeAlternatives.length >= 3) break;
  }
  return safeAlternatives;
}

module.exports = {
  fetchProductByBarcode,
  searchProducts,
  findSafeAlternatives
};
