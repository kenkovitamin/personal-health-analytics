// src/services/dietProfileService.js

export function buildDietProfile(dietInput) {
  if (!dietInput) return null;

  const {
    vegetables_frequency,
    fruits_frequency,
    whole_grains_frequency,
    fish_frequency,
    red_meat_frequency,
    processed_food_frequency,
    sugar_frequency,
    late_meals,
    breakfast_skipped
  } = dietInput;

  // ---------- Fiber density ----------
  let fiber_density = "adequate";
  if (
    vegetables_frequency === "rare" &&
    whole_grains_frequency === "rare"
  ) {
    fiber_density = "low";
  }
  if (
    vegetables_frequency === "daily" &&
    whole_grains_frequency === "daily"
  ) {
    fiber_density = "high";
  }

  // ---------- Inflammatory load ----------
  let inflammatory_load = "moderate";
  if (
    processed_food_frequency === "daily" ||
    sugar_frequency === "daily"
  ) {
    inflammatory_load = "high";
  }
  if (
    processed_food_frequency === "rare" &&
    sugar_frequency === "rare"
  ) {
    inflammatory_load = "low";
  }

  // ---------- Glycemic load ----------
  let glycemic_load = "moderate";
  if (sugar_frequency === "daily") glycemic_load = "high";
  if (sugar_frequency === "rare") glycemic_load = "low";

  // ---------- Protein quality ----------
  let protein_quality = "moderate";
  if (fish_frequency === "rare" && red_meat_frequency === "daily") {
    protein_quality = "low";
  }
  if (fish_frequency === "weekly" && red_meat_frequency !== "daily") {
    protein_quality = "high";
  }

  // ---------- Ultra-processed ratio ----------
  let ultra_processed_ratio = "moderate";
  if (processed_food_frequency === "daily") {
    ultra_processed_ratio = "high";
  }
  if (processed_food_frequency === "rare") {
    ultra_processed_ratio = "low";
  }

  // ---------- Micronutrient risk ----------
  let micronutrient_risk = "moderate";
  if (
    vegetables_frequency === "rare" &&
    fruits_frequency === "rare"
  ) {
    micronutrient_risk = "high";
  }
  if (
    vegetables_frequency === "daily" &&
    fruits_frequency === "daily"
  ) {
    micronutrient_risk = "low";
  }

  return {
    inflammatory_load,
    fiber_density,
    glycemic_load,
    protein_quality,
    ultra_processed_ratio,
    micronutrient_risk
  };
}
