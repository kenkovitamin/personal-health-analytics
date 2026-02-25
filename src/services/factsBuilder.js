// services/factsBuilder.js

// Mapping constants
const smokingMap = { "none": 0, "light": 1, "moderate": 2, "heavy": 3 };
const vapingMap  = { "none": 0, "low": 1, "moderate": 2, "high": 3 };
const alcoholMap = { "low": 1, "moderate": 2, "high": 3 };

// Nutrient value → multiplier
const nutrientValueMap = {
  "deficient": 1.2,
  "suboptimal": 1.1,
  "optimal": 0.9,
  "excess": 1.1
};

/**
 * Build enterprise facts from current DB data
 * @param {number} userId
 * @param {object} client - pg client
 * @returns {Promise<object>} facts object for enterpriseHealthScoreService
 */
export async function buildEnterpriseFactsFromCurrentData(userId, client) {
  // Fetch lifestyle, nutrients, diagnoses, diet
  const lifestyleRes = await client.query(
    `SELECT * FROM health_profile WHERE user_id = $1`,
    [userId]
  );
  const nutrientsRes = await client.query(
    `SELECT * FROM user_nutrients WHERE user_id = $1`,
    [userId]
  );
  const diagnosesRes = await client.query(
    `SELECT c.name 
     FROM user_conditions uc 
     JOIN conditions c ON uc.condition_id = c.id 
     WHERE uc.user_id = $1`,
    [userId]
  );
  const dietRes = await client.query(
    `SELECT * FROM user_diet_profile WHERE user_id = $1`,
    [userId]
  );

  const lifestyleRaw = lifestyleRes.rows[0] || {};

  // Map lifestyle to numeric factors
  const lifestyle = {
    nicotine: (smokingMap[lifestyleRaw.smoking_severity || "none"] || 0) 
            + (vapingMap[lifestyleRaw.vaping || "none"] || 0), // range 0-6
    alcohol: alcoholMap[lifestyleRaw.alcohol || "low"] || 0,
    physical_activity: lifestyleRaw.physical_activity || 0,
    stress: lifestyleRaw.stress || 0,
    sleep_quality: lifestyleRaw.sleep_quality || 0,
    sleep_hours: lifestyleRaw.sleep_hours || null,
    diet_fiber: dietRes.rows[0]?.fiber || null,
    sugar_intake: dietRes.rows[0]?.sugar || null,
    caloric_intake: dietRes.rows[0]?.calories || null
  };

  // Map nutrients
  const nutrients = {};
  nutrientsRes.rows.forEach(n => {
    nutrients[n.code] = nutrientValueMap[n.value] || 1.0;
  });

  // Diagnoses as string array
  const diagnoses = diagnosesRes.rows.map(r => r.name);

  return { lifestyle, nutrients, diagnoses };
}
