import fs from "fs";
import path from "path";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const rulesPath = path.resolve("src/rules/triage.rules.json");
const triageRules = JSON.parse(fs.readFileSync(rulesPath, "utf-8"));

export async function calculateTriage(userId) {
  const client = await pool.connect();

  try {
    const diagnosesRes = await client.query(
      `SELECT c.name 
       FROM user_conditions uc
       JOIN conditions c ON uc.condition_id = c.id
       WHERE uc.user_id = $1`,
      [userId]
    );

    const diagnoses = diagnosesRes.rows.map(r => r.name);

    const symptomsRes = await client.query(
      `SELECT s.name, us.severity, us.created_at
       FROM user_symptoms us
       JOIN symptoms s ON us.symptom_id = s.id
       WHERE us.user_id = $1
       ORDER BY us.created_at DESC
       LIMIT 5`,
      [userId]
    );

    const symptoms = symptomsRes.rows;

    const hasDiverticulitis = diagnoses.includes("diverticulitis");

    const hasSeverePain = symptoms.some(
      s => s.name === "abdominal_pain" && s.severity >= 8
    );

    const hasFever = symptoms.some(
      s => s.name === "fever"
    );

    if (hasDiverticulitis && hasSeverePain && hasFever) {
      return {
        level: "EMERGENCY",
        reasons: ["DIVERTICULITIS_FLARE"]
      };
    }

    return {
      level: "LOW",
      reasons: []
    };

  } finally {
    client.release();
  }
}

