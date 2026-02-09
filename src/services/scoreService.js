export function calculateHealthRiskIndex({
  triage,
  dietSignals,
  lifestyle,
  bmi,
  nutrients
}) {
  // ---------- Clinical ----------
  let clinicalRisk = 0;

  if (triage?.triage_level === "EMERGENCY") clinicalRisk = 1;
  else if (triage?.triage_level === "HIGH_RISK") clinicalRisk = 0.75;
  else if (triage?.triage_level === "MODERATE") clinicalRisk = 0.4;
  else clinicalRisk = 0.1;

  // ---------- Diet ----------
  let dietRisk = 0;
  if (dietSignals) {
    dietRisk += (dietSignals.diet_risks?.length || 0) * 0.2;
    dietRisk += (dietSignals.diet_warnings?.length || 0) * 0.15;
    dietRisk += (dietSignals.diet_gaps?.length || 0) * 0.1;
    dietRisk = Math.min(dietRisk, 1);
  }

  // ---------- Lifestyle ----------
  let lifestyleRisk = 0;
  if (lifestyle?.smoking) lifestyleRisk += 0.5;
  if (lifestyle?.alcohol === "high") lifestyleRisk += 0.4;
  lifestyleRisk = Math.min(lifestyleRisk, 1);

  // ---------- Metabolic ----------
  let metabolicRisk = 0;
  if (bmi >= 30) metabolicRisk = 0.8;
  else if (bmi >= 25) metabolicRisk = 0.5;

  if (nutrients?.some(n => n.code === "VITD" && n.value < 20)) {
    metabolicRisk += 0.2;
  }
  metabolicRisk = Math.min(metabolicRisk, 1);

  // ---------- Weighted sum ----------
  const weightedRisk =
    clinicalRisk * 0.4 +
    dietRisk * 0.25 +
    lifestyleRisk * 0.2 +
    metabolicRisk * 0.15;

  const score = Math.round(100 * (1 - weightedRisk));

  return {
    score,
    breakdown: {
      clinicalRisk,
      dietRisk,
      lifestyleRisk,
      metabolicRisk
    }
  };
}
