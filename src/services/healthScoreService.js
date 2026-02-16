// ==============================
// Health Score Engine (v2)
// Progressive age-based model
// FIXED: smoking, vaping, alcohol
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
  console.log("=== HEALTH SCORE CALCULATION ===");
  console.log("Lifestyle received:", JSON.stringify(lifestyle, null, 2));
  
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
  // LIFESTYLE (FIXED)
  // ======================
  
  // SMOKING (now with severity)
  if (lifestyle?.smoking === true) {
    const severity = lifestyle.smoking_severity || "light";
    
    if (severity === "heavy") {
      breakdown.lifestyle -= 15; // worse than before
    } else if (severity === "moderate") {
      breakdown.lifestyle -= 10; // original penalty
    } else if (severity === "light") {
      breakdown.lifestyle -= 6; // lighter penalty
    }
    
    console.log(`Smoking penalty: ${breakdown.lifestyle} (severity: ${severity})`);
  }

  // VAPING (FIXED - now actually works!)
  if (lifestyle?.vaping) {
    if (lifestyle.vaping === "high") {
      breakdown.lifestyle -= 8;
      console.log("Vaping penalty: -8 (high)");
    } else if (lifestyle.vaping === "moderate") {
      breakdown.lifestyle -= 4;
      console.log("Vaping penalty: -4 (moderate)");
    } else if (lifestyle.vaping === "low") {
      breakdown.lifestyle -= 2;
      console.log("Vaping penalty: -2 (low)");
    }
  }

  // ALCOHOL (was already working, but now with debug)
  if (lifestyle?.alcohol === "high") {
    breakdown.lifestyle -= 10;
    console.log("Alcohol penalty: -10 (high)");
  } else if (lifestyle?.alcohol === "moderate") {
    breakdown.lifestyle -= 5;
    console.log("Alcohol penalty: -5 (moderate)");
  }

  console.log("Total lifestyle penalty:", breakdown.lifestyle);

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

  console.log("=== FINAL HEALTH SCORE ===");
  console.log("Score:", score);
  console.log("Label:", label);
  console.log("Breakdown:", breakdown);
  console.log("===========================");

  return {
    score,
    breakdown,
    label
  };
}
