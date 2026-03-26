import { psoriasisConfig } from "./diseases/psoriasis.js";

const diseaseMap = {
  psoriasis: psoriasisConfig
};

export function runDiseaseEngine(facts, disease) {
  const config = diseaseMap[disease];
  if (!config) return null;

  const inflammation = config.inflammation(facts);
  const immune = config.immune(facts);
  const gut = config.gut(facts);
  const lifestyle = config.lifestyle(facts);

  const total =
    inflammation * config.weights.inflammation +
    immune * config.weights.immune +
    gut * config.weights.gut +
    lifestyle * config.weights.lifestyle

  return {
    disease,
    breakdown: {
      inflammation,
      immune,
      gut,
      lifestyle
    },
    score: Number(total.toFixed(2))
  };
}
