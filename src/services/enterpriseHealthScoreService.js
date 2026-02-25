// enterpriseHealthScoreService.js

/**
 * Calculate HealthScore across 23 risk domains
 * - facts: { age, diagnoses[], lifestyle{}, nutrients[] }
 * - domainConfig: JSON config with 23 domains
 * - previousScore: optional, for delta calculation
 */
export function calculateHealthScore(facts, domainConfig, previousScore = null) {
  const domainRisks = {};

  for (const domainName of Object.keys(domainConfig)) {
    const cfg = domainConfig[domainName];

    // 1️⃣ Sum diagnosis weights
    let diagRisk = 0;
    for (const diag of facts.diagnoses) {
      if (cfg.diagnoses[diag]) diagRisk += cfg.diagnoses[diag];
    }

    // 2️⃣ Lifestyle modifiers
    let lifestyleMultiplier = 1;
    for (const factor in cfg.lifestyle_modifiers) {
      if (facts.lifestyle[factor] !== undefined) {
        lifestyleMultiplier *= Math.pow(cfg.lifestyle_modifiers[factor], facts.lifestyle[factor]);
      }
    }

    // 3️⃣ Nutrient modifiers
    let nutrientMultiplier = 1;
    for (const nutrient of facts.nutrients) {
      if (cfg.nutrient_modifiers[nutrient.code] !== undefined) {
        nutrientMultiplier *= cfg.nutrient_modifiers[nutrient.code];
      }
    }

    // 4️⃣ Age factor (sigmoid)
    const ageFactor = sigmoid(
      facts.age || 40,
      cfg.age_modifier.midpoint,
      cfg.age_modifier.steepness
    );

    // 5️⃣ Domain interactions
    let interactionMultiplier = 1;
    for (const [otherDomain, factor] of Object.entries(cfg.interaction_modifier)) {
      if (domainRisks[otherDomain] !== undefined) {
        interactionMultiplier *= 1 + factor * domainRisks[otherDomain];
      }
    }

    // 6️⃣ Final domain risk
    let risk = (cfg.baseline_risk + diagRisk) * lifestyleMultiplier * nutrientMultiplier * ageFactor * interactionMultiplier;
    domainRisks[domainName] = Math.min(1, risk);
  }

  // 7️⃣ Aggregate HealthScore (mean across domains)
  const totalHealthScore = Object.values(domainRisks).reduce((a, b) => a + b, 0) / Object.keys(domainRisks).length;

  // 8️⃣ Optional delta vs previous score
  let delta = null;
  if (previousScore) {
    delta = totalHealthScore - previousScore.healthScore;
  }

  return {
    healthScore: totalHealthScore,
    domainRisks,
    delta
  };
}

/**
 * Sigmoid function for age-based scaling
 */
function sigmoid(x, midpoint, steepness) {
  return 1 / (1 + Math.exp(-steepness * (x - midpoint)));
}
