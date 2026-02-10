export function generateHealthExplanation({
  healthScore,
  delta,
  triage,
  recommendations
}) {
  const explanation = {
    summary: "",
    main_drivers: [],
    what_hurts_most: [],
    what_helps_fastest: [],
    urgency: "normal"
  };

  // ======================
  // SUMMARY
  // ======================
  explanation.summary = `Health score: ${healthScore.score} (${healthScore.label}).`;

  if (delta.trend === "DECLINING") {
    explanation.summary += " Risk profile is worsening.";
  } else if (delta.trend === "IMPROVING") {
    explanation.summary += " Risk profile is improving.";
  }

  // ======================
  // MAIN DRIVERS
  // ======================
  Object.entries(healthScore.breakdown).forEach(([key, value]) => {
    if (value < 0) {
      explanation.main_drivers.push({
        factor: key,
        impact: value
      });
    }
  });

  // ======================
  // WHAT HURTS MOST
  // ======================
  if (healthScore.breakdown.triage <= -30) {
    explanation.what_hurts_most.push(
      "High clinical risk requires prioritized medical attention"
    );
  }

  if (healthScore.breakdown.lifestyle <= -15) {
    explanation.what_hurts_most.push(
      "Smoking and/or alcohol use significantly increase overall health risk"
    );
  }

  if (healthScore.breakdown.metabolic <= -10) {
    explanation.what_hurts_most.push(
      "Metabolic stress is contributing to elevated risk levels"
    );
  }

  // ======================
  // WHAT HELPS FASTEST
  // ======================
  if (
    recommendations?.recommendations?.lifestyle?.some(r =>
      r.toLowerCase().includes("alcohol")
    )
  ) {
    explanation.what_helps_fastest.push(
      "Alcohol cessation can lead to measurable short-term improvement in health score"
    );
  }

  if (
    recommendations?.recommendations?.lifestyle?.some(r =>
      r.toLowerCase().includes("smoking")
    )
  ) {
    explanation.what_helps_fastest.push(
      "Smoking cessation can significantly reduce overall risk"
    );
  }

  // ======================
  // URGENCY
  // ======================
  if (
    triage.triage_level === "HIGH_RISK" ||
    healthScore.label === "CRITICAL"
  ) {
    explanation.urgency = "high";
  }

  return explanation;
}
