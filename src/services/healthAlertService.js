export function generateHealthAlerts({ healthScore, delta, triage }) {
  const alerts = [];

  // Immediate clinical risk
  if (triage.triage_level === "HIGH_RISK") {
    alerts.push({
      level: "urgent",
      code: "ALERT_HIGH_CLINICAL_RISK",
      message: "High clinical risk detected. Medical follow-up is strongly recommended."
    });
  }

  // Rapid decline
  if (delta.delta <= -10) {
    alerts.push({
      level: "warning",
      code: "ALERT_RAPID_DECLINE",
      message: "Health score is declining significantly over a short period."
    });
  }

  // Critical score
  if (healthScore.score <= 40) {
    alerts.push({
      level: "warning",
      code: "ALERT_LOW_SCORE",
      message: "Overall health score is in a high-risk range."
    });
  }

  return alerts;
}
