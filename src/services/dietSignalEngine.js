export function runDietSignals(dietProfile, facts) {
  const signals = {
    diet_risks: [],
    diet_warnings: [],
    diet_gaps: [],
    confidence: "low"
  };

  if (!dietProfile) {
    return signals;
  }

  let confidenceScore = 0;

  // ===== inflammatory load =====
  if (dietProfile.fast_food_frequency === "often") {
    signals.diet_risks.push("HIGH_INFLAMMATORY_LOAD");
    confidenceScore++;
  }

  if (dietProfile.fried_food_frequency === "daily") {
    signals.diet_risks.push("GASTRO_INFLAMMATION_RISK");
    confidenceScore++;
  }

  if (dietProfile.sugar_intake === "high") {
    signals.diet_risks.push("METABOLIC_STRESS");
    confidenceScore++;
  }

  // ===== protein =====
  if (dietProfile.protein_frequency === "low") {
    signals.diet_gaps.push("LOW_PROTEIN_INTAKE");
    confidenceScore++;
  }

  // ===== fiber =====
  if (dietProfile.vegetables_frequency === "rare") {
    signals.diet_gaps.push("LOW_FIBER_INTAKE");
    confidenceScore++;
  }

  // ===== diagnosis overlay =====
  if (
    facts.diagnoses.includes("diverticulitis") &&
    dietProfile.seeds_nuts_frequency === "often"
  ) {
    signals.diet_warnings.push("MECHANICAL_IRRITATION_RISK");
    confidenceScore++;
  }

  // ===== confidence =====
  if (confidenceScore >= 4) signals.confidence = "high";
  else if (confidenceScore >= 2) signals.confidence = "medium";

  return signals;
}
