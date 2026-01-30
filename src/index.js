import express from "express";
import { runTriage } from "./services/triageService.js";
import pg from "pg";
import bodyParser from "body-parser";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { runRecommendations } from "./services/recommendationService.js";

const app = express();
app.use(bodyParser.json());
const JWT_SECRET = process.env.JWT_SECRET;
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

// API status
app.get("/", (req, res) => {
  res.json({ status: "API running" });
});

// Test DB connection
app.get("/test-db", async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query("SELECT NOW()");
    client.release();
    res.json({ db_time: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Register user
app.post("/register", async (req, res) => {
  const { email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });

  try {
    const client = await pool.connect();
    const result = await client.query(
      "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email",
      [email, hashedPassword]
    );
    client.release();

   const token = jwt.sign(
  { userId: result.rows[0].id },
  JWT_SECRET,
  { expiresIn: "7d" }
);

res.json({
  message: "User registered",
  token
});

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login user
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  try {
    const client = await pool.connect();
    const result = await client.query(
      "SELECT id, password FROM users WHERE email = $1",
      [email]
    );
    client.release();

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { userId: user.id },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get user profile
app.get("/profile", authMiddleware, async (req, res) => {
  const result = await client.query(
  "SELECT id, email FROM users WHERE id = $1",
  [req.user.userId]
);

  try {
    const client = await pool.connect();
    const result = await client.query(
      "SELECT id, email FROM users WHERE id = $1",
      [userId]
    );
    client.release();

    if (result.rows.length === 0) return res.status(404).json({ error: "User not found" });

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add record
app.post("/records", authMiddleware, async (req, res) => {
  const { type, details } = req.body;
  const userId = req.user.userId;

  if (!userId || !type || !details) return res.status(400).json({ error: "Missing fields" });

  try {
    const client = await pool.connect();
    const result = await client.query(
      "INSERT INTO records (user_id, type, details) VALUES ($1, $2, $3) RETURNING id, user_id, type, details",
      [userId, type, details]
    );
    client.release();

    res.json({ message: "Record added", record: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all records of a user
app.get("/records", authMiddleware, async (req, res) => {

  try {
    const client = await pool.connect();
    const result = await client.query(
      "SELECT id, user_id, type, details FROM records WHERE user_id = $1",
      [req.user.userId]
    );
    client.release();

    res.json({ records: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/triage/:userId", async (req, res) => {
  const { userId } = req.params;

  const client = await pool.connect();

  try {
    const diagRes = await client.query(
      `SELECT c.name FROM user_conditions uc
       JOIN conditions c ON uc.condition_id = c.id
       WHERE uc.user_id = $1`,
      [userId]
    );

    const symptomsRes = await client.query(
      `SELECT s.name, us.severity
       FROM user_symptoms us
       JOIN symptoms s ON us.symptom_id = s.id
       WHERE us.user_id = $1
       ORDER BY us.created_at DESC
       LIMIT 5`,
      [userId]
    );

    const lifestyleRes = await client.query(
  `SELECT
     birth_date,
     height_cm,
     weight_kg,
     smoking_status,
     smoking_years,
     cigarettes_per_day,
     vape_frequency,
     alcohol_frequency,
     alcohol_units_per_week
   FROM health_profile
   WHERE user_id = $1`,
  [userId]
);

    const medsRes = await client.query(
  `SELECT m.name
   FROM user_medications um
   JOIN medications m ON um.medication_id = m.id
   WHERE um.user_id = $1`,
  [userId]
);

const suppRes = await client.query(
  `SELECT s.name
   FROM user_supplements us
   JOIN supplements s ON us.supplement_id = s.id
   WHERE us.user_id = $1`,
  [userId]
);

  const rawLifestyle = lifestyleRes.rows[0];

if (!rawLifestyle) {
  return res.status(400).json({
    error: "HEALTH_PROFILE_MISSING",
    message: "Health profile not found. Complete onboarding first."
  });
}

const requiredProfileFields = [
  "birth_date",
  "height_cm",
  "weight_kg",
  "smoking_status",
  "alcohol_frequency"
];

for (const field of requiredProfileFields) {
  if (rawLifestyle[field] === null || rawLifestyle[field] === undefined) {
    return res.status(400).json({
      error: "HEALTH_PROFILE_INCOMPLETE",
      message: `Missing required field: ${field}`
    });
  }
}

const alcoholUnits = rawLifestyle.alcohol_units_per_week || 0;
const alcoholFreq = rawLifestyle.alcohol_frequency || 'none';

const alcoholLevel =
  alcoholUnits >= 21 || alcoholFreq === 'daily'
    ? 'high'
    : alcoholUnits >= 7
      ? 'moderate'
      : 'low';

  const facts = {
  diagnoses: diagRes.rows.map(r => r.name),
  symptoms: symptomsRes.rows,

  medications: medsRes.rows.map(r => r.name),
  supplements: suppRes.rows.map(r => r.name),

  lifestyle: {
    smoking: rawLifestyle.smoking_status === 'current',
    smoking_years: rawLifestyle.smoking_years || 0,
    cigarettes_per_day: rawLifestyle.cigarettes_per_day || 0,
    vape_frequency: rawLifestyle.vape_frequency || 'none',

    alcohol: alcoholLevel,
    alcohol_frequency: rawLifestyle.alcohol_frequency || 'none',
    alcohol_units_per_week: rawLifestyle.alcohol_units_per_week || 0
  },

  bmi,
  markers: {}
};

    const result = await runTriage(facts);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.get("/recommendations/:userId", async (req, res) => {
  const userId = req.params.userId;
  const client = await pool.connect();

  try {
    // ======================
    // DIAGNOSES
    // ======================
    const diagRes = await client.query(
      `SELECT c.name
       FROM user_conditions uc
       JOIN conditions c ON uc.condition_id = c.id
       WHERE uc.user_id = $1`,
      [userId]
    );

    // ======================
    // SYMPTOMS
    // ======================
    const symptomsRes = await client.query(
      `SELECT s.name, us.severity
       FROM user_symptoms us
       JOIN symptoms s ON us.symptom_id = s.id
       WHERE us.user_id = $1
       ORDER BY us.created_at DESC
       LIMIT 5`,
      [userId]
    );

    // ======================
    // HEALTH PROFILE (GATING)
    // ======================
    const lifestyleRes = await client.query(
      `SELECT birth_date, height_cm, weight_kg,
              smoking_status, smoking_years, cigarettes_per_day, vape_frequency,
              alcohol_frequency, alcohol_units_per_week
       FROM health_profile
       WHERE user_id = $1`,
      [userId]
    );

    const rawLifestyle = lifestyleRes.rows[0];

    if (!rawLifestyle) {
      return res.status(400).json({
        error: "HEALTH_PROFILE_MISSING",
        message: "Health profile not found. Complete onboarding first."
      });
    }

    const requiredProfileFields = [
      "birth_date",
      "height_cm",
      "weight_kg",
      "smoking_status",
      "alcohol_frequency"
    ];

    for (const field of requiredProfileFields) {
      if (rawLifestyle[field] === null || rawLifestyle[field] === undefined) {
        return res.status(400).json({
          error: "HEALTH_PROFILE_INCOMPLETE",
          message: `Missing required field: ${field}`
        });
      }
    }

    // ======================
    // ALCOHOL LEVEL
    // ======================
    const alcoholUnits = rawLifestyle.alcohol_units_per_week || 0;
    const alcoholFreq = rawLifestyle.alcohol_frequency || "none";

    const alcoholLevel =
      alcoholUnits >= 21 || alcoholFreq === "daily"
        ? "high"
        : alcoholUnits >= 7
          ? "moderate"
          : "low";

    // ======================
    // BMI
    // ======================
    const heightM = rawLifestyle.height_cm / 100;
    const bmi =
      heightM && rawLifestyle.weight_kg
        ? rawLifestyle.weight_kg / (heightM * heightM)
        : null;

    // ======================
    // MEDICATIONS
    // ======================
    const medsRes = await client.query(
      `SELECT m.name
       FROM user_medications um
       JOIN medications m ON um.medication_id = m.id
       WHERE um.user_id = $1`,
      [userId]
    );

    // ======================
    // NUTRIENTS (LAB / VALUES)
    // ======================
    const nutrientsRes = await client.query(
      `SELECT n.code, un.value, un.source
       FROM user_nutrients un
       JOIN nutrients n ON un.nutrient_id = n.id
       WHERE un.user_id = $1`,
      [userId]
    );

    // ======================
// DIET PROFILE
// ======================
const dietRes = await client.query(
  `SELECT
     diet_type,
     meals_per_day,
     protein_intake_level,
     fiber_intake_level,
     ultra_processed_food_frequency,
     sugar_intake_level,
     vegetables_frequency,
     fruits_frequency
   FROM user_diet_profile
   WHERE user_id = $1`,
  [userId]
);

const rawDiet = dietRes.rows[0];

const dietProfile = rawDiet
  ? {
      diet_type: rawDiet.diet_type,
      meals_per_day: rawDiet.meals_per_day,
      protein_level: rawDiet.protein_intake_level,
      fiber_level: rawDiet.fiber_intake_level,
      ultra_processed_food: rawDiet.ultra_processed_food_frequency,
      sugar_level: rawDiet.sugar_intake_level,
      vegetables_frequency: rawDiet.vegetables_frequency,
      fruits_frequency: rawDiet.fruits_frequency
    }
  : null;

    // ======================
    // FACTS OBJECT
    // ======================
    const facts = {
      diagnoses: diagRes.rows.map(r => r.name),
      symptoms: symptomsRes.rows,

      lifestyle: {
        smoking: rawLifestyle.smoking_status === "current",
        smoking_years: rawLifestyle.smoking_years || 0,
        cigarettes_per_day: rawLifestyle.cigarettes_per_day || 0,
        vape_frequency: rawLifestyle.vape_frequency || "none",

        alcohol: alcoholLevel,
        alcohol_frequency: rawLifestyle.alcohol_frequency || "none",
        alcohol_units_per_week: rawLifestyle.alcohol_units_per_week || 0
      },

      bmi,

      medications: medsRes.rows.map(r => r.name),

      nutrients: nutrientsRes.rows

      diet: dietProfile
    };

    // ======================
    // TRIAGE
    // ======================
    const triageResult = await runTriage(facts);

    // ======================
    // RECOMMENDATIONS
    // ======================
    const recommendations = runRecommendations(facts, triageResult);

    res.json({
      triage: triageResult,
      recommendations
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log("Server started on port", PORT);
});
