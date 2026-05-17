// ==============================
// NUTRIENT ANALYSIS SERVICE
// ==============================

const PSORIASIS_RDA = {
  protein: { value: 80, unit: "g", priority: "moderate" },
  fiber: { value: 30, unit: "g", priority: "high" },
  omega3: { value: 2, unit: "g", priority: "critical" },
  vitaminD: { value: 50, unit: "µg", priority: "critical" },
  vitaminC: { value: 100, unit: "mg", priority: "high" },
  vitaminE: { value: 15, unit: "mg", priority: "moderate" },
  zinc: { value: 11, unit: "mg", priority: "high" },
  calcium: { value: 1000, unit: "mg", priority: "moderate" },
  magnesium: { value: 400, unit: "mg", priority: "moderate" },
  iron: { value: 18, unit: "mg", priority: "moderate" }
};

export function analyzeNutrientDeficiencies(nutrientTotals, days = 7) {
  const dailyAverages = {};
  const deficiencies = [];
  const warnings = [];
  const optimal = [];

  Object.keys(PSORIASIS_RDA).forEach(nutrient => {
    const total = nutrientTotals[nutrient] || 0;
    const dailyAvg = total / days;
    const rda = PSORIASIS_RDA[nutrient];
    const percentOfRDA = (dailyAvg / rda.value) * 100;

    dailyAverages[nutrient] = {
      current: parseFloat(dailyAvg.toFixed(2)),
      target: rda.value,
      unit: rda.unit,
      percent: parseFloat(percentOfRDA.toFixed(1)),
      priority: rda.priority
    };

    if (percentOfRDA < 50) {
      deficiencies.push({
        nutrient,
        current: dailyAvg,
        target: rda.value,
        unit: rda.unit,
        deficit: parseFloat((rda.value - dailyAvg).toFixed(2)),
        severity: "critical",
        priority: rda.priority,
        percent: percentOfRDA
      });
    } else if (percentOfRDA < 80) {
      warnings.push({
        nutrient,
        current: dailyAvg,
        target: rda.value,
        unit: rda.unit,
        deficit: parseFloat((rda.value - dailyAvg).toFixed(2)),
        severity: "moderate",
        priority: rda.priority,
        percent: percentOfRDA
      });
    } else {
      optimal.push({
        nutrient,
        current: dailyAvg,
        target: rda.value,
        unit: rda.unit,
        percent: percentOfRDA
      });
    }
  });

  return {
    daily_averages: dailyAverages,
    deficiencies: deficiencies.sort((a, b) => {
      const priorityOrder = { critical: 3, high: 2, moderate: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    }),
    warnings: warnings.sort((a, b) => {
      const priorityOrder = { critical: 3, high: 2, moderate: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    }),
    optimal,
    overall_score: calculateNutrientScore(dailyAverages)
  };
}

function calculateNutrientScore(dailyAverages) {
  let totalScore = 0;
  let weightedTotal = 0;

  const weights = {
    critical: 3,
    high: 2,
    moderate: 1
  };

  Object.keys(dailyAverages).forEach(nutrient => {
    const data = dailyAverages[nutrient];
    const weight = weights[data.priority];
    const score = Math.min(100, data.percent);
    
    totalScore += score * weight;
    weightedTotal += 100 * weight;
  });

  return {
    score: parseFloat((totalScore / weightedTotal * 100).toFixed(1)),
    grade: 
      totalScore / weightedTotal >= 0.9 ? "excellent" :
      totalScore / weightedTotal >= 0.75 ? "good" :
      totalScore / weightedTotal >= 0.6 ? "fair" :
      "needs_improvement"
  };
}

export function generateNutrientRecommendations(deficiencies, warnings) {
  const recommendations = {
    food_sources: [],
    supplements: [],
    priority_actions: []
  };

  if (deficiencies.find(d => d.nutrient === "omega3") || warnings.find(w => w.nutrient === "omega3")) {
    recommendations.food_sources.push({
      nutrient: "Omega-3",
      foods: ["Salmon (wild)", "Sardines", "Mackerel", "Chia seeds", "Walnuts", "Flaxseeds"],
      serving_example: "100g salmon = 2.5g omega-3"
    });
    recommendations.supplements.push({
      nutrient: "Omega-3",
      recommendation: "Fish oil: 2000-3000mg EPA/DHA daily",
      priority: "critical"
    });
    recommendations.priority_actions.push("Eat fatty fish 3x per week");
  }

  if (deficiencies.find(d => d.nutrient === "vitaminD") || warnings.find(w => w.nutrient === "vitaminD")) {
    recommendations.food_sources.push({
      nutrient: "Vitamin D",
      foods: ["Fatty fish", "Egg yolks", "Fortified milk", "Mushrooms (UV-exposed)"],
      serving_example: "100g salmon = 10µg vitamin D"
    });
    recommendations.supplements.push({
      nutrient: "Vitamin D",
      recommendation: "Vitamin D3: 2000-5000 IU daily (test levels first)",
      priority: "critical"
    });
    recommendations.priority_actions.push("Get 15 min sunlight daily + supplement");
  }

  if (deficiencies.find(d => d.nutrient === "fiber") || warnings.find(w => w.nutrient === "fiber")) {
    recommendations.food_sources.push({
      nutrient: "Fiber",
      foods: ["Vegetables", "Fruits", "Legumes", "Whole grains", "Chia seeds"],
      serving_example: "1 cup broccoli = 5g fiber"
    });
    recommendations.priority_actions.push("Add vegetables to every meal");
  }

  if (deficiencies.find(d => d.nutrient === "vitaminC")) {
    recommendations.food_sources.push({
      nutrient: "Vitamin C",
      foods: ["Bell peppers", "Broccoli", "Strawberries", "Kiwi", "Citrus fruits"],
      serving_example: "1 bell pepper = 150mg vitamin C"
    });
  }

  if (deficiencies.find(d => d.nutrient === "zinc") || warnings.find(w => w.nutrient === "zinc")) {
    recommendations.food_sources.push({
      nutrient: "Zinc",
      foods: ["Oysters", "Beef", "Pumpkin seeds", "Chickpeas", "Cashews"],
      serving_example: "30g pumpkin seeds = 3mg zinc"
    });
    recommendations.supplements.push({
      nutrient: "Zinc",
      recommendation: "Zinc: 15-30mg daily (with 2mg copper)",
      priority: "high"
    });
  }

  return recommendations;
}
