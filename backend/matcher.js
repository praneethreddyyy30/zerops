// matcher.js
// Core logical engine that parses ingredients and nutrition facts against user profiles.

const TRIGGER_MAP = {
  allergies: {
    dairy: {
      keywords: ['milk', 'lactose', 'whey', 'casein', 'butter', 'cheese', 'cream', 'yogurt', 'curd', 'ghee', 'caseinate', 'lactalbumin', 'custard'],
      message: 'Contains dairy/milk derivatives.'
    },
    gluten: {
      keywords: ['wheat', 'barley', 'rye', 'spelt', 'oats', 'malt', 'semolina', 'farina', 'triticale', 'durum', 'einkorn', 'kamut', 'gluten'],
      message: 'Contains gluten-bearing grains.'
    },
    peanut: {
      keywords: ['peanut', 'arachis'],
      message: 'Contains peanuts.'
    },
    'tree-nut': {
      keywords: ['almond', 'walnut', 'cashew', 'pecan', 'hazelnut', 'macadamia', 'pistachio', 'brazil nut', 'chestnut', 'coconut'],
      message: 'Contains tree nuts.'
    },
    soy: {
      keywords: ['soy', 'soya', 'tofu', 'tempeh', 'edamame', 'miso'],
      message: 'Contains soy.'
    },
    egg: {
      keywords: ['egg', 'albumin', 'ovalbumin', 'yolk', 'lecithin (egg)'],
      message: 'Contains egg products.'
    },
    shellfish: {
      keywords: ['shrimp', 'crab', 'lobster', 'prawn', 'krill', 'mussel', 'clam', 'oyster', 'scallop'],
      message: 'Contains shellfish.'
    },
    sesame: {
      keywords: ['sesame', 'tahini'],
      message: 'Contains sesame.'
    }
  },
  diets: {
    vegan: {
      keywords: ['meat', 'pork', 'beef', 'chicken', 'fish', 'gelatin', 'lard', 'tallow', 'carmine', 'cochineal', 'shellac', 'honey', 'egg', 'milk', 'lactose', 'whey', 'casein', 'butter', 'cheese', 'cream', 'ghee', 'anchovies', 'casing (pork)'],
      message: 'Contains animal-derived ingredients (non-vegan).'
    },
    vegetarian: {
      keywords: ['meat', 'pork', 'beef', 'chicken', 'fish', 'gelatin', 'lard', 'tallow', 'carmine', 'cochineal'],
      message: 'Contains meat/slaughter products (non-vegetarian).'
    }
  },
  conditions: {
    diabetes: {
      keywords: ['sugar', 'sucrose', 'high-fructose corn syrup', 'dextrose', 'maltodextrin', 'glucose', 'corn syrup'],
      message: 'Contains high-glycemic sweeteners.'
    },
    'kidney-disease': {
      keywords: ['potassium chloride', 'phosphoric acid', 'sodium phosphate', 'potassium phosphate', 'pyophosphate', 'polyphosphate'],
      message: 'Contains potassium or phosphorus additives harmful in kidney disease.'
    }
  }
};

/**
 * Clean and tokenize raw ingredients string.
 */
function tokenizeIngredients(ingredientsText) {
  if (!ingredientsText) return [];
  // Split by commas, semicolons, or parentheses, and clean up
  return ingredientsText
    .toLowerCase()
    .split(/[,;()]/)
    .map(i => i.replace(/[.*+?^${}()|[\]\\]/g, '').trim())
    .filter(i => i.length > 0);
}

/**
 * Matches user warnings and goals against a product.
 * @param {Object} product - Product details from Open Food Facts
 * @param {Object} profile - User profile preferences { allergies, diets, conditions, goals }
 */
function analyzeProduct(product, profile) {
  const {
    ingredients_text = '',
    nutriments = {}
  } = product;

  const allergies = profile.allergies || [];
  const diets = profile.diets || [];
  const conditions = profile.conditions || [];
  const goals = profile.goals || [];

  const tokens = tokenizeIngredients(ingredients_text);
  const triggered_warnings = [];
  const met_goals = [];
  let safety_status = 'safe';

  // 1. Process Allergies, Diets, and Conditions
  const checkGroups = [
    { list: allergies, category: 'allergies' },
    { list: diets, category: 'diets' },
    { list: conditions, category: 'conditions' }
  ];

  checkGroups.forEach(({ list, category }) => {
    list.forEach(item => {
      const config = TRIGGER_MAP[category][item];
      if (config) {
        // Check keywords
        const matchingKeyword = tokens.find(token =>
          config.keywords.some(kw => token.includes(kw))
        );

        if (matchingKeyword) {
          triggered_warnings.push({
            type: item,
            category,
            trigger: matchingKeyword,
            message: config.message
          });
          safety_status = 'danger';
        }
      } else {
        // Custom user-defined allergen or health condition (substring search)
        const cleanItem = item.toLowerCase().trim();
        if (cleanItem.length > 0) {
          const matchingKeyword = tokens.find(token => token.includes(cleanItem));
          if (matchingKeyword) {
            triggered_warnings.push({
              type: item,
              category,
              trigger: matchingKeyword,
              message: `Contains custom-flagged ${category === 'allergies' ? 'allergen' : 'ingredient'} "${item}".`
            });
            safety_status = 'danger';
          }
        }
      }
    });
  });

  // 2. Extra Medical Condition Rules (Numerical checks)
  // Hypertension -> Check Sodium
  if (conditions.includes('hypertension')) {
    const sodium = parseFloat(nutriments.sodium_100g || 0); // in grams
    if (sodium > 0.4) { // > 400mg per 100g
      triggered_warnings.push({
        type: 'hypertension',
        category: 'conditions',
        trigger: `Sodium (${(sodium * 1000).toFixed(0)}mg / 100g)`,
        message: 'High sodium content exceeds low-sodium limit (>400mg/100g).'
      });
      safety_status = 'danger';
    }
  }

  // Diabetes -> Check Sugar
  if (conditions.includes('diabetes')) {
    const sugar = parseFloat(nutriments.sugars_100g || 0); // in grams
    if (sugar > 15) { // > 15g per 100g
      triggered_warnings.push({
        type: 'diabetes',
        category: 'conditions',
        trigger: `Sugars (${sugar.toFixed(1)}g / 100g)`,
        message: 'High sugar concentration exceeds diabetic safety threshold (>15g/100g).'
      });
      safety_status = 'danger';
    }
  }

  // 3. Fitness Goals Checks (Numerical criteria)
  // High Protein
  if (goals.includes('high-protein')) {
    const protein = parseFloat(nutriments.proteins_100g || 0);
    const meets = protein >= 10;
    met_goals.push({
      goal: 'high-protein',
      value: `${protein.toFixed(1)}g`,
      meets,
      message: meets 
        ? 'High protein level (>=10g/100g) met!' 
        : 'Does not meet high protein criteria (<10g/100g).'
    });
  }

  // Keto / Low Carb
  if (goals.includes('low-carb')) {
    const carbs = parseFloat(nutriments.carbohydrates_100g || 0);
    const meets = carbs <= 5;
    met_goals.push({
      goal: 'low-carb',
      value: `${carbs.toFixed(1)}g`,
      meets,
      message: meets 
        ? 'Low carb / Keto approved (<=5g/100g)!' 
        : 'Carb level exceeds low-carb threshold (>5g/100g).'
    });
  }

  // High Fiber
  if (goals.includes('high-fiber')) {
    const fiber = parseFloat(nutriments.fiber_100g || 0);
    const meets = fiber >= 6;
    met_goals.push({
      goal: 'high-fiber',
      value: `${fiber.toFixed(1)}g`,
      meets,
      message: meets 
        ? 'High fiber target (>=6g/100g) met!' 
        : 'Low fiber content (<6g/100g).'
    });
  }

  // Low Calorie
  if (goals.includes('low-calorie')) {
    const calories = parseFloat(nutriments['energy-kcal_100g'] || 0);
    const meets = calories <= 150;
    met_goals.push({
      goal: 'low-calorie',
      value: `${calories.toFixed(0)} kcal`,
      meets,
      message: meets 
        ? 'Low calorie item (<=150 kcal/100g) met!' 
        : 'Calorie count exceeds low-calorie threshold (>150 kcal/100g).'
    });
  }

  // 4. Custom Goals Check
  const standardGoals = ['high-protein', 'low-carb', 'high-fiber', 'low-calorie'];
  goals.forEach(goal => {
    if (!standardGoals.includes(goal)) {
      let meets = false;
      let val = 'N/A';
      let msg = '';
      const cleanGoal = goal.toLowerCase().trim();

      if (cleanGoal === 'low-fat') {
        const fat = parseFloat(nutriments.fat_100g ?? 0);
        meets = fat <= 3;
        val = `${fat.toFixed(1)}g`;
        msg = meets ? 'Low fat target (<=3g/100g) met!' : 'Fat content exceeds low-fat limit (>3g/100g).';
      } else if (cleanGoal === 'no-msg') {
        const msgKeywords = ['monosodium glutamate', 'msg', 'glutamic acid', 'yeast extract', 'hydrolyzed vegetable protein'];
        const foundMsg = tokens.find(t => msgKeywords.some(kw => t.includes(kw)));
        meets = !foundMsg;
        val = foundMsg ? 'Found' : 'Not Found';
        msg = meets ? 'No MSG found!' : `Contains MSG derivative: "${foundMsg}".`;
      } else if (cleanGoal.length > 0) {
        // General text-based ingredient preference goal (e.g. "honey" or "oats")
        const found = tokens.find(t => t.includes(cleanGoal));
        meets = !!found;
        val = found ? 'Found' : 'Not Found';
        msg = meets ? `Goal matched: "${goal}" ingredient found!` : `Could not locate ingredient "${goal}".`;
      }

      if (cleanGoal.length > 0) {
        met_goals.push({
          goal,
          value: val,
          meets,
          message: msg
        });
      }
    }
  });

  // 4. Map Individual Ingredients for UI Highlighting
  const parsed_ingredients = tokenizeIngredients(ingredients_text).map(ing => {
    let ingStatus = 'safe';
    
    // Check if this ingredient triggered any warning
    const triggered = triggered_warnings.find(w => 
      ing.includes(w.trigger.toLowerCase()) || 
      (TRIGGER_MAP[w.category] && TRIGGER_MAP[w.category][w.type] && TRIGGER_MAP[w.category][w.type].keywords.some(kw => ing.includes(kw)))
    );

    if (triggered) {
      ingStatus = 'danger';
    }

    return {
      name: ing,
      status: ingStatus
    };
  });

  // If there are no danger triggers, check if we have warnings
  if (safety_status === 'safe' && tokens.length === 0) {
    safety_status = 'warning'; // Warning due to incomplete ingredients list
  }

  return {
    safety_status,
    triggered_warnings,
    met_goals,
    parsed_ingredients
  };
}

module.exports = {
  analyzeProduct,
  tokenizeIngredients
};
