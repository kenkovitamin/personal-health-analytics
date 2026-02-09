export function calculateHealthRiskIndex({
  triage,
  dietSignals,
  lifestyle,
  bmi,
  nutrients
}) {
  let score = 100;

  const breakdown = {
    triage: 0,
    diet: 0,
    lifestyle: 0,
    metabolic: 0,
    nutrients: 0
  };

  // ======================
  // TRIAGE (dominant)
  // ======================
  if (triage?.triage_level === "EMERGENCY") {
    breakdown.triage = -60;
  } else if (triage?.triage_level === "HIGH_RISK") {
    breakdown.triage = -35;
  } else if (triage?.triage_level === "MODERATE") {
    breakdown.triage = -15;
  }

  // ======================
  // DIET SIGNALS
  // ======================
  if (dietSignals) {
    const riskPenalty = (dietSignals.diet_risks || []).length * 5;
    const warningPenalty = (dietSignals.diet_warnings || []).length * 3;
    const gapPenalty = (dietSignals.diet_gaps || []).length * 4;

    breakdown.diet = -(riskPenalty + warningPenalty + gapPenalty);
  }

  // ======================
  // LIFESTYLE
  // ======================
  if (lifestyle?.smoking === true) {
    breakdown.lifestyle -= 10;
  }

  if (lifestyle?.alcohol === "high") {
    breakdown.lifestyle -= 10;
  } else if (lifestyle?.alcohol === "moderate") {
    breakdown.lifestyle -= 5;
  }

  // ======================
  // METABOLIC (BMI)
  // ======================
  if (typeof bmi === "number") {
    if (bmi >= 30) breakdown.metabolic -= 15;
    else if (bmi >= 25) breakdown.metabolic -= 8;
    else if (bmi < 18.5) breakdown.metabolic -= 5;
  }

  // ======================
  // NUTRIENTS (light weight)
  // ======================
  if (Array.isArray(nutrients)) {
    nutrients.forEach(n => {
      if (n.value === "deficient") breakdown.nutrients -= 3;
      if (n.value === "excess") breakdown.nutrients -= 2;
    });
  }

  // ======================
  // FINAL SCORE
  // ======================
  score +=
    breakdown.triage +
    breakdown.diet +
    breakdown.lifestyle +
    breakdown.metabolic +
    breakdown.nutrients;

  if (score < 0) score = 0;
  if (score > 100) score = 100;

  return {
    score,
    breakdown,
    label:
      score >= 80
        ? "LOW_RISK"
        : score >= 55
        ? "MODERATE_RISK"
        : score >= 35
        ? "HIGH_RISK"
        : "CRITICAL"
  };
}
