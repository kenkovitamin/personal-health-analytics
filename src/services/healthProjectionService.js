export function projectHealthScore({ healthScore, recommendations }) {
  const projections = [];

  const addProjection = ({
    action,
    timeframe_days,
    expected_score_change,
    confidence
  }) => {
    projections.push({
      action,
      timeframe_days,
      expected_score_change,
      projected_score: Math.min(
        100,
        healthScore.score + expected_score_change
      ),
      confidence
    });
  };

  // Alcohol cessation
  if (
    recommendations?.recommendations?.lifestyle?.some(r =>
      r.toLowerCase().includes("alcohol")
    )
  ) {
    addProjection({
      action: "ALCOHOL_CESSATION",
      timeframe_days: 30,
      expected_score_change: 10,
      confidence: "medium"
    });
  }

  // Smoking cessation
  if (
    recommendations?.recommendations?.lifestyle?.some(r =>
      r.toLowerCase().includes("smoking")
    )
  ) {
    addProjection({
      action: "SMOKING_CESSATION",
      timeframe_days: 30,
      expected_score_change: 8,
      confidence: "medium"
    });
  }

  // Physical activity
  if (
    recommendations?.recommendations?.lifestyle?.some(r =>
      r.toLowerCase().includes("physical")
    )
  ) {
    addProjection({
      action: "PHYSICAL_ACTIVITY",
      timeframe_days: 30,
      expected_score_change: 5,
      confidence: "low"
    });
  }

  return projections;
}
