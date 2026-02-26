// ==============================
// Health Score Engine (v3)
// Progressive age-based model
// Nicotine unified risk model
// Recovery logic
// Alcohol-nicotine synergy
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

// ==============================
// RECOVERY FACTOR
// Penalty decreases over time after quitting
// ==============================
function calculateRecoveryFactor(quitDate) {
  if (!quitDate) return 1.0;

  const today = new Date();
  const quit = new Date(quitDate);
  const monthsQuit = (today - quit) / (1000 * 60 * 60 * 24 * 30.44);

  if (monthsQuit < 1)  return 1.0;
  if (monthsQuit < 6)  return 0.7;
  if (monthsQuit < 12) return 0.4;
  if (monthsQuit < 24) return 0.2;
  return 0.0;
}

// ==============================
// BEHAVIORAL AGE FACTOR
// Behavioral risk carries more weight with age
// ==============================
function calculateBehavioralAgeFactor(age) {
  if (!age) return 1.0;
  if (age >= 65) return 1.6;
  if (age >= 55) return 1.4;
  if (age >= 45) return 1.25;
  if (age >= 35) return 1.1;
  return 1.0;
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
  // TRIAGE (dominant factor)
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
    const riskPenalty    = (dietSignals.diet_risks    || []).length * 5;
    const warningPenalty = (dietSignals.diet_warnings || []).length * 3;
    const gapPenalty     = (dietSignals.diet_gaps     || []).length * 4;
    breakdown.diet = -(riskPenalty + warningPenalty + gapPenalty);
  }

  // ======================
  // LIFESTYLE
  // ======================
  const age = calculateAge(birth_date);
  const ageFactor = calculateBehavioralAgeFactor(age);

  // --- SMOKING BASE ---
  let smokingBase = 0;
  if (lifestyle?.smoking === true) {
    const severity = lifestyle.smoking_severity || "light";
    if (severity === "heavy")         smokingBase = -15;
    else if (severity === "moderate") smokingBase = -10;
    else                              smokingBase = -6;

    const recoveryFactor = calculateRecoveryFactor(lifestyle.smoking_quit_date);
    smokingBase = smokingBase * recoveryFactor;
  } else if (lifestyle?.smoking === false && lifestyle?.smoking_quit_date) {
    // Former smoker - apply recovery logic
    const recoveryFactor = calculateRecoveryFactor(lifestyle.smoking_quit_date);
    if (recoveryFactor > 0) {
      smokingBase = -6 * recoveryFactor;
    }
  }

  // --- VAPING BASE ---
  let vapingBase = 0;
  if (lifestyle?.vaping && lifestyle.vaping !== "none") {
    if (lifestyle.vaping === "high")          vapingBase = -8;
    else if (lifestyle.vaping === "moderate") vapingBase = -4;
    else if (lifestyle.vaping === "low")      vapingBase = -2;

    const recoveryFactor = calculateRecoveryFactor(lifestyle.vaping_quit_date);
    vapingBase = vapingBase * recoveryFactor;
  } else if (lifestyle?.vaping === "none" && lifestyle?.vaping_quit_date) {
    // Former vaper - apply recovery logic
    const recoveryFactor = calculateRecoveryFactor(lifestyle.vaping_quit_date);
    if (recoveryFactor > 0) {
      vapingBase = -2 * recoveryFactor;
    }
  }

  // --- NICOTINE SYNERGY ---
  // Both active: combined penalty with multiplier, not a double hit
  let nicotinePenalty = 0;
  const bothActive = lifestyle?.smoking === true &&
                     lifestyle?.vaping !== "none" &&
                     lifestyle?.vaping;

  if (bothActive) {
    nicotinePenalty = (smokingBase + vapingBase) * 1.2;
  } else {
    nicotinePenalty = smokingBase + vapingBase;
  }

  // --- ALCOHOL ---
  let alcoholPenalty = 0;
  if (lifestyle?.alcohol === "high")          alcoholPenalty = -10;
  else if (lifestyle?.alcohol === "moderate") alcoholPenalty = -5;

  // --- ALCOHOL + NICOTINE SYNERGY ---
  const hasNicotine = nicotinePenalty < 0;
  let alcoholNicotineSynergy = 1.0;

  if (hasNicotine && lifestyle?.alcohol === "high") {
    alcoholNicotineSynergy = 1.2;
  } else if (hasNicotine && lifestyle?.alcohol === "moderate") {
    alcoholNicotineSynergy = 1.1;
  }

  // --- FINAL LIFESTYLE PENALTY ---
  const rawLifestylePenalty = (nicotinePenalty + alcoholPenalty) * alcoholNicotineSynergy;
  breakdown.lifestyle = Math.round(rawLifestylePenalty * ageFactor);

  // ======================
  // METABOLIC (BMI)
  // ======================
  if (typeof bmi === "number") {
    if (bmi >= 30)       breakdown.metabolic -= 15;
    else if (bmi >= 25)  breakdown.metabolic -= 8;
    else if (bmi < 18.5) breakdown.metabolic -= 5;
  }

  // ======================
  // AGE (progressive metabolic risk)
  // ======================
  if (typeof age === "number") {
    if (age >= 65)      breakdown.metabolic -= 28;
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
  // NUTRIENTS
  // ======================
  if (Array.isArray(nutrients)) {
    nutrients.forEach(n => {
      if (n.value === "deficient") breakdown.nutrients -= 3;
      if (n.value === "excess")    breakdown.nutrients -= 2;
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

  if (score < 0)   score = 0;
  if (score > 100) score = 100;

  // ======================
  // LABEL
  // ======================
  const label =
    score >= 80 ? "LOW_RISK"      :
    score >= 55 ? "MODERATE_RISK" :
    score >= 35 ? "HIGH_RISK"     :
                  "CRITICAL";

  return { score, breakdown, label };
}
