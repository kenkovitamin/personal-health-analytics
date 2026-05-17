// ==============================
// PSORIASIS SCORING ENGINE v2
// Calculates Psoriasis Activity Index (PAI)
// Based on: inflammation, immune, gut, lifestyle
// ==============================

export const psoriasisConfig = {
  weights: {
    inflammation: 0.35,
    immune: 0.25,
    gut: 0.20,
    lifestyle: 0.20
  },

  // ==============================
  // INFLAMMATION SCORE (0-10)
  // Primary driver: body surface area + recent symptom severity
  // ==============================
  inflammation: (facts) => {
    let score = 0;

    // Body surface area (BSA) - primary indicator
    if (facts.psoriasis?.body_surface_area) {
      const bsa = facts.psoriasis.body_surface_area;
      if (bsa >= 10) score += 4;        // severe (>10%)
      else if (bsa >= 3) score += 2.5;  // moderate (3-10%)
      else if (bsa > 0) score += 1;     // mild (<3%)
    }

    // Recent symptom severity (last 7 days average)
    if (facts.recentSymptoms && facts.recentSymptoms.length > 0) {
      const avgSeverity = facts.recentSymptoms.reduce((sum, s) => sum + s.severity, 0) 
                         / facts.recentSymptoms.length;
      score += (avgSeverity / 10) * 3; // 0-3 points based on severity
    }

    // BMI contribution (obesity increases inflammation)
    if (facts.bmi) {
      if (facts.bmi >= 30) score += 2;
      else if (facts.bmi >= 25) score += 1;
    }

    // Alcohol (inflammatory)
    if (facts.lifestyle?.alcohol === "high") score += 1;
    else if (facts.lifestyle?.alcohol === "moderate") score += 0.5;

    return Math.min(10, score); // cap at 10
  },

  // ==============================
  // IMMUNE SCORE (0-10)
  // Immune dysfunction markers
  // ==============================
  immune: (facts) => {
    let score = 0;

    // Vitamin D deficiency (critical for immune regulation)
    const vitaminD = facts.nutrients?.find(n => n.code === "vitaminD");
    if (vitaminD) {
      if (vitaminD.value < 20) score += 3;      // severe deficiency
      else if (vitaminD.value < 30) score += 2; // deficiency
      else if (vitaminD.value < 40) score += 1; // insufficiency
    }

    // Omega-3 (anti-inflammatory, immune modulator)
    const omega3 = facts.nutrients?.find(n => n.code === "omega3");
    if (omega3) {
      if (omega3.value < 200) score += 2;       // low
      else if (omega3.value < 500) score += 1;  // suboptimal
    }

    // Zinc (immune function)
    const zinc = facts.nutrients?.find(n => n.code === "zinc");
    if (zinc) {
      if (zinc.value < 8) score += 1.5;
      else if (zinc.value < 11) score += 0.5;
    }

    // Family history (genetic predisposition)
    if (facts.psoriasis?.family_history) score += 1;

    // Smoking (immune suppression)
    if (facts.lifestyle?.smoking) score += 1.5;

    return Math.min(10, score);
  },

  // ==============================
  // GUT SCORE (0-10)
  // Gut health markers (leaky gut hypothesis)
  // ==============================
  gut: (facts) => {
    let score = 0;
    
 // Inflammatory load from recent food logs
  if (facts.inflammatory_load_avg !== undefined) {
    if (facts.inflammatory_load_avg > 3) score += 2;
    else if (facts.inflammatory_load_avg > 1) score += 1;
    else if (facts.inflammatory_load_avg < -2) score -= 1;
  }
    
    // Diet quality indicators
    if (facts.diet) {
      // Low fiber (gut dysbiosis)
      if (facts.diet.fiber_intake === "low") score += 2;
      
      // High sugar (inflammatory)
      if (facts.diet.sugar_intake === "high") score += 1.5;
      
      // Ultra-processed foods
      if (facts.diet.ultra_processed_food === "high") score += 1.5;
      
      // Low fruit/veg (lack of prebiotics)
      if (facts.diet.fruit_veg_frequency === "rare") score += 1;
    }

    // Alcohol (gut barrier damage)
    if (facts.lifestyle?.alcohol === "high") score += 1.5;
    else if (facts.lifestyle?.alcohol === "moderate") score += 0.5;

    // Probiotic deficiency (inferred from diet)
    if (facts.diet?.diet_type !== "mediterranean" && 
        facts.diet?.diet_type !== "anti_inflammatory") {
      score += 1;
    }

    return Math.min(10, score);
  },

  // ==============================
  // LIFESTYLE SCORE (0-10)
  // Stress, sleep, environmental triggers
  // ==============================
  lifestyle: (facts) => {
    let score = 0;

    // Smoking (major trigger)
    if (facts.lifestyle?.smoking) score += 2.5;

    // Alcohol (trigger for many)
    if (facts.lifestyle?.alcohol === "high") score += 2;
    else if (facts.lifestyle?.alcohol === "moderate") score += 1;

    // Recent symptom patterns (trigger frequency)
    if (facts.recentSymptoms && facts.recentSymptoms.length > 0) {
      const triggersCount = facts.recentSymptoms
        .filter(s => s.triggers_suspected && s.triggers_suspected.length > 0)
        .length;
      
      if (triggersCount >= 3) score += 2; // frequent triggers
      else if (triggersCount >= 1) score += 1;
    }

    // Stress indicators (from symptom logs)
    const stressTriggered = facts.recentSymptoms?.some(s => 
      s.triggers_suspected?.includes("stress")
    );
    if (stressTriggered) score += 1.5;

    // Physical activity (protective)
    if (facts.lifestyle?.activity_level === "sedentary") score += 1;

    return Math.min(10, score);
  }
};
