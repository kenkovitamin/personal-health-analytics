import fs from "fs";
import path from "path";

const rulesPath = path.resolve("src/rules/triage.rules.json");
const rulesData = JSON.parse(fs.readFileSync(rulesPath, "utf-8"));

export async function runTriage(userFacts) {
  const { diagnoses, symptoms, lifestyle } = userFacts;
  
    console.log("TRIAGE FACTS", JSON.stringify(userFacts, null, 2));

  let matchedRules = [];

  for (const rule of rulesData.rules) {
    let match = true;

    // diagnoses check
    if (rule.conditions.diagnoses) {
      for (const d of rule.conditions.diagnoses) {
        if (!diagnoses.includes(d)) {
          match = false;
        }
      }
    }

    // lifestyle check
    if (rule.conditions.lifestyle) {
      for (const key in rule.conditions.lifestyle) {
        if (lifestyle[key] !== rule.conditions.lifestyle[key]) {
          match = false;
        }
      }
    }

    // symptoms check
    if (rule.conditions.symptoms) {
      for (const key in rule.conditions.symptoms) {
        if (key === "pain_severity_gte") {
          const pain = symptoms.find(s => s.name === "abdominal_pain");
          if (!pain || pain.severity < rule.conditions.symptoms[key]) {
            match = false;
          }
        } else {
          const exists = symptoms.some(s => s.name === key);
          if (!exists) {
            match = false;
          }
        }
      }
    }

    if (match) matchedRules.push(rule);
  }

  if (matchedRules.length === 0) {
    return { triage_level: "LOW", reasons: [] };
  }

  matchedRules.sort(
    (a, b) =>
      rulesData.triage_levels_priority.indexOf(a.level) -
      rulesData.triage_levels_priority.indexOf(b.level)
  );

  const topRule = matchedRules[0];

  return {
    triage_level: topRule.level,
    reasons: [topRule.id]
  };
}

