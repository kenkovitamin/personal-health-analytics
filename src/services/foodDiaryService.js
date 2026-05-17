// ==============================
// FOOD DIARY SERVICE
// USDA FoodData Central API Integration
// ==============================

import fetch from "node-fetch";

const USDA_API_KEY = process.env.USDA_API_KEY;
const USDA_BASE_URL = "https://api.nal.usda.gov/fdc/v1";

// Search for foods in USDA database
export async function searchFood(query) {
  try {
    const response = await fetch(
      `${USDA_BASE_URL}/foods/search?query=${encodeURIComponent(query)}&pageSize=10&api_key=${USDA_API_KEY}`
    );

    if (!response.ok) {
      throw new Error(`USDA API error: ${response.status}`);
    }

    const data = await response.json();

    // Transform USDA response to our format
    return data.foods.map(food => ({
      fdc_id: food.fdcId,
      description: food.description,
      brand: food.brandOwner || food.brandName || null,
      category: food.foodCategory || null,
      nutrients: extractNutrients(food.foodNutrients || [])
    }));

  } catch (error) {
    console.error("Food search error:", error);
    throw error;
  }
}

// Get detailed food info by FDC ID
export async function getFoodDetails(fdcId) {
  try {
    const response = await fetch(
      `${USDA_BASE_URL}/food/${fdcId}?api_key=${USDA_API_KEY}`
    );

    if (!response.ok) {
      throw new Error(`USDA API error: ${response.status}`);
    }

    const food = await response.json();

    return {
      fdc_id: food.fdcId,
      description: food.description,
      brand: food.brandOwner || food.brandName || null,
      category: food.foodCategory || null,
      portion_size: food.servingSize || 100,
      portion_unit: food.servingSizeUnit || "g",
      nutrients: extractNutrients(food.foodNutrients || [])
    };

  } catch (error) {
    console.error("Food details error:", error);
    throw error;
  }
}

// Extract relevant nutrients from USDA format
function extractNutrients(foodNutrients) {
  const nutrientMap = {
    1003: "protein",           // Protein (g)
    1004: "total_fat",         // Total fat (g)
    1005: "carbohydrates",     // Carbs (g)
    1008: "calories",          // Energy (kcal)
    1079: "fiber",             // Fiber (g)
    1087: "calcium",           // Calcium (mg)
    1089: "iron",              // Iron (mg)
    1090: "magnesium",         // Magnesium (mg)
    1092: "potassium",         // Potassium (mg)
    1093: "sodium",            // Sodium (mg)
    1095: "zinc",              // Zinc (mg)
    1106: "vitaminA",          // Vitamin A (mcg)
    1109: "vitaminE",          // Vitamin E (mg)
    1114: "vitaminD",          // Vitamin D (mcg)
    1162: "vitaminC",          // Vitamin C (mg)
    1165: "vitaminB6",         // Vitamin B6 (mg)
    1177: "vitaminB12",        // Vitamin B12 (mcg)
    1178: "vitaminK",          // Vitamin K (mcg)
    1258: "omega3",            // Omega-3 (g)
    2000: "sugar"              // Sugars (g)
  };

  const nutrients = {};

  foodNutrients.forEach(fn => {
    const nutrientId = fn.nutrient?.id || fn.nutrientId;
    const nutrientName = nutrientMap[nutrientId];
    
    if (nutrientName) {
      nutrients[nutrientName] = {
        value: fn.amount || fn.value || 0,
        unit: fn.nutrient?.unitName || fn.unitName || "g"
      };
    }
  });

  return nutrients;
}

// Calculate inflammatory load for a food
export function calculateFoodInflammatoryLoad(nutrients, quantity = 100) {
  let inflammatoryScore = 0;

  // Pro-inflammatory factors (increase score = bad)
  if (nutrients.sugar) {
    const sugarAmount = (nutrients.sugar.value / 100) * quantity;
    if (sugarAmount > 10) inflammatoryScore += 2;
    else if (sugarAmount > 5) inflammatoryScore += 1;
  }

  if (nutrients.sodium) {
    const sodiumAmount = (nutrients.sodium.value / 100) * quantity;
    if (sodiumAmount > 500) inflammatoryScore += 2;
    else if (sodiumAmount > 300) inflammatoryScore += 1;
  }

  // Saturated fat (if available, would need additional nutrient ID)
  // For now, use total fat as proxy
  if (nutrients.total_fat) {
    const fatAmount = (nutrients.total_fat.value / 100) * quantity;
    if (fatAmount > 20) inflammatoryScore += 1;
  }

  // Anti-inflammatory factors (decrease score = good)
  if (nutrients.omega3) {
    const omega3Amount = (nutrients.omega3.value / 100) * quantity;
    if (omega3Amount > 1) inflammatoryScore -= 3;
    else if (omega3Amount > 0.5) inflammatoryScore -= 2;
  }

  if (nutrients.fiber) {
    const fiberAmount = (nutrients.fiber.value / 100) * quantity;
    if (fiberAmount > 5) inflammatoryScore -= 2;
    else if (fiberAmount > 3) inflammatoryScore -= 1;
  }

  if (nutrients.vitaminC) {
    const vitCAmount = (nutrients.vitaminC.value / 100) * quantity;
    if (vitCAmount > 50) inflammatoryScore -= 1;
  }

  if (nutrients.vitaminE) {
    const vitEAmount = (nutrients.vitaminE.value / 100) * quantity;
    if (vitEAmount > 5) inflammatoryScore -= 1;
  }

  return {
    inflammatory_score: inflammatoryScore,
    classification: 
      inflammatoryScore <= -3 ? "highly_anti_inflammatory" :
      inflammatoryScore <= -1 ? "anti_inflammatory" :
      inflammatoryScore <= 1 ? "neutral" :
      inflammatoryScore <= 3 ? "inflammatory" :
      "highly_inflammatory"
  };
}
