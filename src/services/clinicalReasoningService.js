// clinicalReasoningService.js
// Purpose: derive biological health state from user facts
// No recommendations. No treatments. No assumptions.

export function runClinicalReasoning(facts) {
  const {
    diagnoses = [],
    symptoms = [],
    lifestyle = {},
    bmi = null,
    medications = [],
    supplements = []
  } = facts;

  const health_state = {
    inflammation: "low",
    immune_load: "normal",
    gut_tolerance: "normal",
    metabolic_risk: "low",
    stress_load: "low"
  };

  const reasoning = {
    inflammation: [],
    immune_load: [],
    gut_tolerance: [],
    metabolic_risk: [],
    stress_load: []
  };

  // -------------------------------
  // INFLAMMATION AXIS
  // -------------------------------

  const inflammatoryDiagnoses = [
    "psoriasis",
    "ibd",
    "crohns",
    "ulcerative_colitis",
    "diverticulitis"
  ];

  if (diagnoses.some(d => inflammatoryDiagnoses.includes(d))) {
    health_state.inflammation = "high";
    reasoning.inflammation.push("chronic inflammatory diagnosis");
  }

  const inflammatorySymptoms = [
    "joint_pain",
    "chronic_fatigue",
    "skin_flare",
    "abdominal_pain"
  ];

  if (symptoms.some(s => inflammatorySymptoms.includes(s.name))) {
    health_state.inflammation =
      health_state.inflammation === "high" ? "high" : "moderate";
    reasoning.inflammation.push("inflammatory symptom pattern");
  }

  if (lifestyle.alcohol === "high") {
    health_state.inflammation = "high";
    reasoning.inflammation.push("high alcohol load");
  }

  // -------------------------------
  // IMMUNE AXIS
  // -------------------------------

  const autoimmuneDiagnoses = [
    "psoriasis",
    "hashimoto",
    "rheumatoid_arthritis",
    "lupus"
  ];

  if (diagnoses.some(d => autoimmuneDiagnoses.includes(d))) {
    health_state.immune_load = "autoimmune";
    reasoning.immune_load.push("autoimmune diagnosis");
  }

  // -------------------------------
  // GUT TOLERANCE AXIS
  // -------------------------------

  const gutDiagnoses = [
    "gastritis",
    "peptic_ulcer",
    "diverticulitis",
    "ibs"
  ];

  if (diagnoses.some(d => gutDiagnoses.includes(d))) {
    health_state.gut_tolerance = "inflamed";
    reasoning.gut_tolerance.push("gastrointestinal diagnosis");
  }

  const gutSymptoms = [
    "bloating",
    "diarrhea",
    "constipation",
    "abdominal_pain",
    "nausea"
  ];

  if (
    symptoms.some(s => gutSymptoms.includes(s.name)) &&
    health_state.gut_tolerance !== "inflamed"
  ) {
    health_state.gut_tolerance = "sensitive";
    reasoning.gut_tolerance.push("digestive symptom pattern");
  }

  // -------------------------------
  // METABOLIC AXIS
  // -------------------------------

  if (bmi !== null) {
    if (bmi >= 30) {
      health_state.metabolic_risk = "high";
      reasoning.metabolic_risk.push("obesity range BMI");
    } else if (bmi >= 25) {
      health_state.metabolic_risk = "moderate";
      reasoning.metabolic_risk.push("overweight BMI");
    }
  }

  // -------------------------------
  // STRESS AXIS
  // -------------------------------

  const stressSymptoms = [
    "insomnia",
    "anxiety",
    "palpitations",
    "burnout"
  ];

  if (symptoms.some(s => stressSymptoms.includes(s.name))) {
    health_state.stress_load = "moderate";
    reasoning.stress_load.push("stress-related symptom pattern");
  }

  if (medications.some(m =>
    ["benzodiazepine", "ssri", "snri"].includes(m)
  )) {
    health_state.stress_load = "high";
    reasoning.stress_load.push("psychotropic medication
