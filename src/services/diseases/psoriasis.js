export const psoriasisConfig = {
  weights: {
    inflammation: 0.35,
    immune: 0.25,
    gut: 0.2,
    lifestyle: 0.2
  },

  inflammation: (facts) => {
    let score = 0;

    if (facts.bmi && facts.bmi > 30) score += 2;
    if (facts.lifestyle.alcohol === "high") score += 2;
    if (facts.lifestyle.smoking) score += 2;

    return score;
  },

  immune: (facts) => {
    let score = 0;

    const vitaminD = facts.nutrients.find(n => n.code === "vitaminD");
    if (vitaminD?.value === "deficient") score += 2;

    const omega3 = facts.nutrients.find(n => n.code === "omega3");
    if (omega3?.value === "low") score += 1;

    return score;
  },

  gut: (facts) => {
    let score = 0;

    if (facts.diet?.fiber < 15) score += 2;
    if (facts.diet?.sugar > 50) score += 1;

    return score;
  },

  lifestyle: (facts) => {
    let score = 0;

    if (facts.lifestyle.stress === "high") score += 2;
    if (facts.lifestyle.sleep_quality === "poor") score += 2;

    return score;
  }
};
