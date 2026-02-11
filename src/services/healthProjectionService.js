export function projectHealthScore({ healthScore, recommendations }) {
  const projections = [];

  // Alcohol cessation
  if (
    recommendations?.recommendations?.lifestyle?.some(r =>
      r.toLowerCase().includes("alcohol")
    )
  ) {
    projections.push({
      action: "ALCOHOL_CESSATION",
      timeframe_days: 30,
      expected_score_change: +10,
      confidence: "medium"
    });
  }

  // Smoking cessation
  if (
    recommendations?.recommendations?.lifestyle?.some(r =>
      r.toLowerCase().includes("smoking")
    )
  ) {
    projections.push({
      action: "SMOKING_CESSATION",
      timeframe_days: 30,
      expected_score_change: +8,
      confidence: "medium"
    });
  }

  // Physical activity
  if (
    recommendations?.recommendations?.lifestyle?.some(r =>
      r.toLowerCase().includes("physical")
    )
  ) {
    projections.push({
      action: "PHYSICAL_ACTIVITY",
      timeframe_days: 30,
      expected_score_change: +5,
      confidence: "low"
    });
  }

  return projections;
}
