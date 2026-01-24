export function runRecommendations(userFacts, triageResult) {
  const { diagnoses } = userFacts;
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

  // base by triage
  if (triage_level === "EMERGENCY") {
    output.recommendations.monitoring.push("Immediate medical evaluation required");
    output.recommendations.lifestyle.push("Stop alcohol and smoking immediately");
    output.recommendations.nutrition.push("Clear fluids only until assessed");
  }

  if (triage_level === "HIGH_RISK") {
    output.recommendations.monitoring.push("Gastroenterologist consultation within 1–2 weeks");
    output.recommendations.lifestyle.push("Eliminate alcohol", "Stop smoking");
    output.recommendations.nutrition.push("Low-acid, low-fat diet");
    output.recommendations.supplements.push("Probiotics (short-term)", "Zinc carnosine");
  }

  if (triage_level === "MODERATE") {
    output.recommendations.monitoring.push("Baseline blood panel (CBC, ferritin, B12, vitamin D)");
    output.recommendations.lifestyle.push("Stress reduction", "Sleep optimization");
    output.recommendations.nutrition.push("Anti-inflammatory diet");
    output.recommendations.supplements.push("Omega-3", "Vitamin D", "Zinc");
  }

  if (triage_level === "LOW") {
    output.recommendations.lifestyle.push("Maintain activity level");
    output.recommendations.nutrition.push("Balanced diet");
    output.recommendations.monitoring.push("Annual check-up");
  }

  // diagnosis overlays
  if (diagnoses.includes("psoriasis")) {
    output.risk_summary.push("AUTOIMMUNE_BACKGROUND", "CHRONIC_INFLAMMATION");
    output.recommendations.supplements.push("Curcumin");
    output.recommendations.monitoring.push("CRP, ESR", "Vitamin D recheck in 3 months");
  }

  if (diagnoses.includes("peptic_ulcer")) {
    output.risk_summary.push("GASTRIC_MUCOSA_DAMAGE");
  }

  return output;
}
