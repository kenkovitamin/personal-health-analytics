// ==============================
// Health Score Engine (v2)
// Progressive age-based model
// ==============================

function calculateAge(birthDate) {
  if (!birthDate) return null;

  const today = new Date();
  const dob = new Date(birthDate);

  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();

  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }

  return age;
}

export function calculateHealthRiskIndex({
  triage,
  dietSignals,
  lifestyle,
  bmi,
  nutrients,
  birth_date
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
  // AGE (progressive risk)
  // ======================
  const age = calculateAge(birth_date);

  if (typeof age === "number") {
    if (age >= 65) breakdown.metabolic -= 28;
    else if (age >= 60) breakdown.metabolic -= 22;
    else if (age >= 55) breakdown.metabolic -= 17;
    else if (age >= 50) breakdown.metabolic -= 13;
    else if (age >= 45) breakdown.metabolic -= 10;
    else if (age >= 40) breakdown.metabolic -= 7;
    else if (age >= 35) breakdown.metabolic -= 5;
    else if (age >= 30) breakdown.metabolic -= 3;
    else if (age >= 25) breakdown.metabolic -= 2;
    else if (age >= 20) breakdown.metabolic -= 1;
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

  // Clamp 0–100
  if (score < 0) score = 0;
  if (score > 100) score = 100;

  // ======================
  // LABEL
  // ======================
  const label =
    score >= 80
      ? "LOW_RISK"
      : score >= 55
      ? "MODERATE_RISK"
      : score >= 35
      ? "HIGH_RISK"
      : "CRITICAL";

  return {
    score,
    breakdown,
    label
  };
}
