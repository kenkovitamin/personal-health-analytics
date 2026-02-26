export function calculateHealthDelta(previous, current) {
  if (!previous) {
    return {
      delta: 0,
      trend: "BASELINE",
      drivers: []
    };
  }

  const delta = current.score - previous.score;

  const drivers = [];

  for (const key in current.breakdown) {
    const prevVal = previous.breakdown[key] || 0;
    const currVal = current.breakdown[key] || 0;

    if (prevVal !== currVal) {
      drivers.push({
        factor: key,
        change: currVal - prevVal
      });
    }
  }

  return {
    delta,
    trend:
      delta > 5 ? "IMPROVING" :
      delta < -5 ? "DECLINING" :
      "STABLE",
    drivers
  };
}
