import fs from "fs";
import path from "path";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const rulesPath = path.resolve("rules/triage.rules.json");
const triageRules = JSON.parse(fs.readFileSync(rulesPath, "utf-8"));

export async function calculateTriage(userId) {
  // Пока заглушка — логики НЕТ
  // Это нормально на этом этапе

  return {
    level: "LOW",
    reasons: []
  };
}
