export function runRecommendations(userFacts, triageResult) {
  const { diagnoses, lifestyle, bmi, medications, supplements } = userFacts;
  const { triage_level } = triageResult;

  const output = {
    risk_summary: [],
    recommendations: {
      nutrition: [],
      supplements: [],
      lifestyle: [],
      monitoring: []
    }
  };

  // ---------- Base by triage ----------
  if (triage_level === "EMERGENCY") {
    output.risk_summary.push("ACUTE_RISK");

    output.recommendations.monitoring.push(
      "Immediate medical evaluation required"
    );

    output.recommendations.lifestyle.push(
      "Stop alcohol immediately",
      "Stop smoking immediately"
    );

    output.recommendations.nutrition.push(
      "Clear fluids only until assessed"
    );
  }

  if (triage_level === "HIGH_RISK") {
    output.risk_summary.push("ELEVATED_RISK");

    output.recommendations.monitoring.push(
      "Gastroenterologist consultation within 1–2 weeks"
    );

    output.recommendations.lifestyle.push(
      "Eliminate alcohol",
      "Stop smoking"
    );

    output.recommendations.nutrition.push(
      "Low-acid, low-fat diet"
    );

    output.recommendations.supplements.push(
      "Probiotics (short-term)",
      "Zinc carnosine"
    );
  }

  if (triage_level === "MODERATE") {
    output.risk_summary.push("MODERATE_RISK");

    output.recommendations.monitoring.push(
      "Baseline blood panel (CBC, ferritin, B12, vitamin D)"
    );

    output.recommendations.lifestyle.push(
      "Stress reduction",
      "Sleep optimization"
    );

    output.recommendations.nutrition.push(
      "Anti-inflammatory diet"
    );

    output.recommendations.supplements.push(
      "Omega-3",
      "Vitamin D",
      "Zinc"
    );
  }

  if (triage_level === "LOW") {
    output.risk_summary.push("BASELINE_RISK");

    output.recommendations.lifestyle.push(
      "Maintain activity level"
    );

    output.recommendations.nutrition.push(
      "Balanced diet"
    );

    output.recommendations.monitoring.push(
      "Annual check-up"
    );
  }

  // ---------- Diagnosis overlays ----------
  if (diagnoses.includes("psoriasis")) {
    output.risk_summary.push(
      "AUTOIMMUNE_BACKGROUND",
      "CHRONIC_INFLAMMATION"
    );

    output.recommendations.supplements.push(
      "Curcumin"
    );

    output.recommendations.monitoring.push(
      "CRP, ESR",
      "Vitamin D recheck in 3 months"
    );
  }

  if (diagnoses.includes("peptic_ulcer")) {
    output.risk_summary.push(
      "GASTRIC_MUCOSA_DAMAGE"
    );

    output.recommendations.nutrition.push(
      "Avoid spicy foods",
      "Avoid NSAIDs",
      "Avoid alcohol"
    );
  }

  if (diagnoses.includes("diverticulitis")) {
    output.risk_summary.push(
      "COLON_INFLAMMATION_RISK"
    );

    output.recommendations.nutrition.push(
      "Gradual fiber increase",
      "Avoid seeds during flare"
    );
  }

  // ---------- Lifestyle overlays ----------
  if (lifestyle.smoking === true) {
    output.risk_summary.push("SMOKING_RISK");

    output.recommendations.lifestyle.push(
      "Structured smoking cessation plan"
    );
  }

  if (lifestyle.alcohol === "high") {
    output.risk_summary.push("ALCOHOL_RISK");

    output.recommendations.lifestyle.push(
      "Strict alcohol cessation"
    );
  }

  // ---------- BMI overlays ----------
  if (bmi && bmi >= 25) {
    output.risk_summary.push("METABOLIC_RISK");

    output.recommendations.nutrition.push(
      "Caloric moderation",
      "Increase protein ratio"
    );

    output.recommendations.lifestyle.push(
      "Structured physical activity plan"
    );
  }

  // ---------- Medication awareness ----------
  if (medications && medications.length > 0) {
    output.risk_summary.push("ACTIVE_MEDICATION_USE");

    output.recommendations.monitoring.push(
      "Review medication–nutrient interactions"
    );
  }

  // ---------- Supplement awareness ----------
  if (supplements && supplements.length > 0) {
    output.recommendations.monitoring.push(
      "Review supplement interactions and dosing"
    );
  }

  return output;
}
