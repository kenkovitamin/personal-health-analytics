import express from "express";
import pg from "pg";
import bodyParser from "body-parser";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { runTriage } from "./services/triageService.js";
import { runRecommendations } from "./services/recommendationService.js";
import { runDietSignals } from "./services/dietSignalEngine.js";
import { calculateHealthRiskIndex } from "./services/healthScoreService.js";
import { calculateHealthDelta } from "./services/healthDeltaService.js";
import { generateHealthExplanation } from "./services/healthExplainService.js";
import { generateHealthAlerts } from "./services/healthAlertService.js";
import { projectHealthScore } from "./services/healthProjectionService.js";

const app = express();
app.use(bodyParser.json());

const JWT_SECRET = process.env.JWT_SECRET;

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

/* =========================
   AUTH MIDDLEWARE
========================= */
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const token = authHeader.split(" ")[1];
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
};

/* =========================
   BASIC
========================= */
app.get("/", (_, res) => {
  res.json({ status: "API running" });
});

app.get("/test-db", async (_, res) => {
  const client = await pool.connect();
  try {
    const r = await client.query("SELECT NOW()");
    res.json({ db_time: r.rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

/* =========================
   AUTH
========================= */
app.post("/register", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  const hash = await bcrypt.hash(password, 10);
  const client = await pool.connect();

  try {
    const r = await client.query(
      "INSERT INTO users (email, password) VALUES ($1,$2) RETURNING id",
      [email, hash]
    );

    const token = jwt.sign({ userId: r.rows[0].id }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token });
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const client = await pool.connect();

  try {
    const r = await client.query(
      "SELECT id, password FROM users WHERE email = $1",
      [email]
    );

    if (!r.rows.length || !(await bcrypt.compare(password, r.rows[0].password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ userId: r.rows[0].id }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token });
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

/* =========================
   RECORDS
========================= */
app.post("/records", authMiddleware, async (req, res) => {
  const { type, details } = req.body;
  const userId = req.user.userId;

  if (!type || !details) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const client = await pool.connect();
  try {
    const r = await client.query(
      "INSERT INTO records (user_id, type, details) VALUES ($1,$2,$3) RETURNING *",
      [userId, type, details]
    );
    res.json(r.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

app.get("/records", authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const r = await client.query(
      "SELECT * FROM records WHERE user_id = $1",
      [req.user.userId]
    );
    res.json(r.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

/* =========================
   RECOMMENDATIONS PIPELINE
========================= */
app.get("/recommendations/:userId", async (req, res) => {
  const userId = req.params.userId;
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
      `SELECT *
       FROM health_profile
       WHERE user_id = $1`,
      [userId]
    );

    const lifestyle = lifestyleRes.rows[0];
    if (!lifestyle) {
      return res.status(400).json({ error: "HEALTH_PROFILE_MISSING" });
    }

    const heightM = lifestyle.height_cm / 100;
    const bmi =
      lifestyle.weight_kg && heightM
        ? lifestyle.weight_kg / (heightM * heightM)
        : null;

    const alcoholUnits = lifestyle.alcohol_units_per_week || 0;
    const alcoholFreq = lifestyle.alcohol_frequency || "none";
    const alcohol =
      alcoholUnits >= 21 || alcoholFreq === "daily"
        ? "high"
        : alcoholUnits >= 7
          ? "moderate"
          : "low";

    const medsRes = await client.query(
      `SELECT m.name FROM user_medications um
       JOIN medications m ON um.medication_id = m.id
       WHERE um.user_id = $1`,
      [userId]
    );

    const nutrientsRes = await client.query(
      `SELECT n.code, un.value, un.source
       FROM user_nutrients un
       JOIN nutrients n ON un.nutrient_id = n.id
       WHERE un.user_id = $1`,
      [userId]
    );

    const dietRes = await client.query(
      `SELECT * FROM user_diet_profile WHERE user_id = $1`,
      [userId]
    );

    const facts = {
      diagnoses: diagRes.rows.map(r => r.name),
      symptoms: symptomsRes.rows,
      bmi,
      medications: medsRes.rows.map(r => r.name),
      nutrients: nutrientsRes.rows,
      lifestyle: {
        smoking: lifestyle.smoking_status === "current",
        alcohol
      },
      diet: dietRes.rows[0] || null
    };
    
// ======================
// TRIAGE
// ======================
const triage = await runTriage(facts);

// ======================
// RECOMMENDATIONS
// ======================
console.log(
  "RECOMMENDATION INPUT",
  JSON.stringify(facts, null, 2)
);

const recommendations = runRecommendations(facts, triage);

// ======================
// SCORE (PURE CALCULATION)
// ======================
const healthScore = calculateHealthRiskIndex({
  triage,
  dietSignals: recommendations.diet_analysis || null,
  lifestyle: facts.lifestyle,
  bmi: facts.bmi,
  nutrients: facts.nutrients
});
    const prevScoreRes = await client.query(
  `SELECT score, breakdown
   FROM user_health_score_history
   WHERE user_id = $1
   ORDER BY created_at DESC
   LIMIT 1`,
  [userId]
);

const previousScore = prevScoreRes.rows[0] || null;

const delta = calculateHealthDelta(previousScore, healthScore);

    await client.query(
  `INSERT INTO user_health_score_history
   (user_id, score, label, breakdown, triage_level)
   VALUES ($1,$2,$3,$4,$5)`,
  [
    userId,
    healthScore.score,
    healthScore.label,
    healthScore.breakdown,
    triage.triage_level
  ]
);
    
const explanation = generateHealthExplanation({
  healthScore,
  delta,
  triage,
  recommendations
});
  
  const alerts = generateHealthAlerts({
  healthScore,
  delta,
  triage
});

const projections = projectHealthScore({
  healthScore,
  recommendations
});

// ======================
// PERSIST DIET ANALYSIS (OPTIONAL)
// ======================
if (recommendations.diet_analysis) {
  await client.query(
    `INSERT INTO user_diet_analysis
     (user_id, diet_risks, diet_warnings, diet_gaps, confidence)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (user_id) DO UPDATE SET
       diet_risks = EXCLUDED.diet_risks,
       diet_warnings = EXCLUDED.diet_warnings,
       diet_gaps = EXCLUDED.diet_gaps,
       confidence = EXCLUDED.confidence,
       updated_at = NOW()`,
    [
      userId,
      recommendations.diet_analysis.diet_risks,
      recommendations.diet_analysis.diet_warnings,
      recommendations.diet_analysis.diet_gaps,
      recommendations.diet_analysis.confidence
    ]
  );
}

// ======================
// RESPONSE
// ======================
res.json({
  triage,
  health_score: healthScore,
  delta,
  explanation,
  alerts,
  projections,
  recommendations
});

  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

/* ========================= */
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log("Server running on", PORT);
});
