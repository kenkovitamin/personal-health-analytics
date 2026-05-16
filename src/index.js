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
import { runDiseaseEngine } from "./services/diseaseEngine.js";

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
    
    // ====================================
    // BMI CALCULATION
    // ====================================
    const heightM = lifestyle.height_cm / 100;
    const bmi =
      lifestyle.weight_kg && heightM
        ? lifestyle.weight_kg / (heightM * heightM)
        : null;

     // ====================================
    // ALCOHOL PROCESSING
    // ====================================
 let alcohol = "low";

if (lifestyle.alcohol_units_per_week !== null && 
    lifestyle.alcohol_units_per_week !== undefined &&
    lifestyle.alcohol_units_per_week > 0) {
  const alcoholUnits = lifestyle.alcohol_units_per_week;
  if (alcoholUnits >= 15) {
    alcohol = "high";
  } else if (alcoholUnits >= 5) {
    alcohol = "moderate";
  } else {
    alcohol = "low";
  }
} else if (lifestyle.alcohol_frequency) {
  alcohol = lifestyle.alcohol_frequency;
}

    // ====================================
    // SMOKING PROCESSING (FIXED)
    // ====================================
    const isSmoking = lifestyle.smoking_status === "current";
    const smokingYears = lifestyle.smoking_years || 0;
    const cigarettesPerDay = lifestyle.cigarettes_per_day || 0;

    // Calculate smoking severity
    let smokingSeverity = "none";
    if (isSmoking) {
      const packYears = (cigarettesPerDay / 20) * smokingYears;
      if (packYears >= 20 || cigarettesPerDay >= 20) {
        smokingSeverity = "heavy";
      } else if (packYears >= 10 || cigarettesPerDay >= 10) {
        smokingSeverity = "moderate";
      } else {
        smokingSeverity = "light";
      }
    }

    // ====================================
    // VAPING PROCESSING (FIXED)
    // ====================================
    const vaping = lifestyle.vape_frequency || "none";

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

    // ====================================
    // FACTS OBJECT (FIXED)
    // ====================================
   const facts = {
  diagnoses: diagRes.rows.map(r => r.name),
  symptoms: symptomsRes.rows,
  bmi,
  medications: medsRes.rows.map(r => r.name),
  nutrients: nutrientsRes.rows,
  lifestyle: {
    smoking: isSmoking,
    smoking_severity: smokingSeverity,
    smoking_years: smokingYears,
    cigarettes_per_day: cigarettesPerDay,
    smoking_quit_date: lifestyle.smoking_quit_date || null,
    vaping,
    vaping_quit_date: lifestyle.vaping_quit_date || null,
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

    const recommendations = runRecommendations(facts, triage);

    // ======================
    // DISEASE
    // ======================
    
    const diseaseInsights = runDiseaseEngine(facts, "psoriasis");
    
    // ======================
    // SCORE (PURE CALCULATION)
    // ======================
    const healthProfileResult = await pool.query(
      "SELECT birth_date FROM health_profile WHERE user_id = $1",
      [userId]
    );

    const healthProfile = healthProfileResult.rows[0];
    
    const healthScore = calculateHealthRiskIndex({
      triage,
      dietSignals: recommendations.diet_analysis || null,
      lifestyle: facts.lifestyle,
      bmi: facts.bmi,
      nutrients: facts.nutrients,
      birth_date: healthProfile?.birth_date
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
      recommendations,
      disease: diseaseInsights
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});
/* =========================
   PSORIASIS PROFILE
========================= */

// Create or update psoriasis profile
app.post("/psoriasis-profile", authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  const {
    diagnosed,
    diagnosis_date,
    psoriasis_type,
    body_surface_area,
    severity,
    current_treatments,
    family_history,
    onset_age
  } = req.body;

  // Validation
  if (diagnosed === undefined) {
    return res.status(400).json({ error: "diagnosed field is required" });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO psoriasis_profile (
        user_id, diagnosed, diagnosis_date, psoriasis_type, 
        body_surface_area, severity, current_treatments, 
        family_history, onset_age, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      ON CONFLICT (user_id) 
      DO UPDATE SET
        diagnosed = EXCLUDED.diagnosed,
        diagnosis_date = EXCLUDED.diagnosis_date,
        psoriasis_type = EXCLUDED.psoriasis_type,
        body_surface_area = EXCLUDED.body_surface_area,
        severity = EXCLUDED.severity,
        current_treatments = EXCLUDED.current_treatments,
        family_history = EXCLUDED.family_history,
        onset_age = EXCLUDED.onset_age,
        updated_at = NOW()
      RETURNING *`,
      [
        userId,
        diagnosed,
        diagnosis_date || null,
        psoriasis_type || null,
        body_surface_area || null,
        severity || null,
        current_treatments || null,
        family_history || false,
        onset_age || null
      ]
    );

    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// Get psoriasis profile
app.get("/psoriasis-profile", authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  const client = await pool.connect();

  try {
    const result = await client.query(
      "SELECT * FROM psoriasis_profile WHERE user_id = $1",
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Psoriasis profile not found" });
    }

    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

/* =========================
   SYMPTOM TRACKING
========================= */

// Log a symptom entry
app.post("/symptom-log", authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  const {
    severity,
    itching,
    scaling,
    redness,
    thickness,
    affected_areas,
    triggers_suspected,
    notes,
    mood
  } = req.body;

  // Validation
  if (severity === undefined || severity < 0 || severity > 10) {
    return res.status(400).json({ 
      error: "severity is required and must be between 0 and 10" 
    });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO psoriasis_symptom_logs (
        user_id, severity, itching, scaling, redness, thickness,
        affected_areas, triggers_suspected, notes, mood
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        userId,
        severity,
        itching || null,
        scaling || null,
        redness || null,
        thickness || null,
        affected_areas || null,
        triggers_suspected || null,
        notes || null,
        mood || null
      ]
    );

    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// Get symptom history
app.get("/symptom-history", authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  const { period = "month", limit = 100 } = req.query;

  let dateFilter = "created_at >= NOW() - INTERVAL '30 days'";
  if (period === "week") {
    dateFilter = "created_at >= NOW() - INTERVAL '7 days'";
  } else if (period === "year") {
    dateFilter = "created_at >= NOW() - INTERVAL '1 year'";
  } else if (period === "all") {
    dateFilter = "1=1";
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT * FROM psoriasis_symptom_logs 
       WHERE user_id = $1 AND ${dateFilter}
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, parseInt(limit)]
    );

    // Calculate summary stats
    const logs = result.rows;
    const summary = {
      total_entries: logs.length,
      avg_severity: logs.length > 0 
        ? (logs.reduce((sum, l) => sum + l.severity, 0) / logs.length).toFixed(1)
        : 0,
      avg_itching: logs.filter(l => l.itching).length > 0
        ? (logs.filter(l => l.itching).reduce((sum, l) => sum + l.itching, 0) / logs.filter(l => l.itching).length).toFixed(1)
        : null,
      most_common_triggers: getMostCommonTriggers(logs),
      most_affected_areas: getMostAffectedAreas(logs)
    };

    res.json({
      logs,
      summary,
      period
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// Helper functions for symptom history
function getMostCommonTriggers(logs) {
  const triggerCounts = {};
  logs.forEach(log => {
    if (log.triggers_suspected) {
      log.triggers_suspected.forEach(trigger => {
        triggerCounts[trigger] = (triggerCounts[trigger] || 0) + 1;
      });
    }
  });
  
  return Object.entries(triggerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([trigger, count]) => ({ trigger, count }));
}

function getMostAffectedAreas(logs) {
  const areaCounts = {};
  logs.forEach(log => {
    if (log.affected_areas) {
      log.affected_areas.forEach(area => {
        areaCounts[area] = (areaCounts[area] || 0) + 1;
      });
    }
  });
  
  return Object.entries(areaCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([area, count]) => ({ area, count }));
}

/* =========================
   PSORIASIS ACTIVITY INDEX
========================= */

// Get PAI for user
app.get("/psoriasis-score", authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  const client = await pool.connect();

  try {
    // Get all necessary data
    const profileRes = await client.query(
      "SELECT * FROM psoriasis_profile WHERE user_id = $1",
      [userId]
    );

    const healthRes = await client.query(
      "SELECT * FROM health_profile WHERE user_id = $1",
      [userId]
    );

    const nutrientsRes = await client.query(
      `SELECT n.code, un.value, un.unit
       FROM user_nutrients un
       JOIN nutrients n ON un.nutrient_id = n.id
       WHERE un.user_id = $1`,
      [userId]
    );

    const symptomsRes = await client.query(
      `SELECT * FROM psoriasis_symptom_logs
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 7`,
      [userId]
    );

    if (profileRes.rows.length === 0) {
      return res.status(404).json({ 
        error: "Psoriasis profile not found. Please complete onboarding first." 
      });
    }

    const psoriasisProfile = profileRes.rows[0];
    const healthProfile = healthRes.rows[0];
    const nutrients = nutrientsRes.rows;
    const recentSymptoms = symptomsRes.rows;

    // Calculate PAI using diseaseEngine
    const facts = {
      psoriasis: psoriasisProfile,
      bmi: healthProfile ? 
        (healthProfile.weight_kg / Math.pow(healthProfile.height_cm / 100, 2)) : null,
      lifestyle: {
        smoking: healthProfile?.smoking_status === "current",
        alcohol: healthProfile?.alcohol_frequency || "low"
      },
      nutrients: nutrients.map(n => ({ 
        code: n.code, 
        value: n.value 
      })),
      recentSymptoms
    };

    const diseaseScore = runDiseaseEngine(facts, "psoriasis");

    // Save to history
    await client.query(
      `INSERT INTO psoriasis_activity_history (
        user_id, pai_score, inflammation_score, immune_score,
        gut_score, lifestyle_score, breakdown
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        userId,
        diseaseScore.score,
        diseaseScore.breakdown.inflammation,
        diseaseScore.breakdown.immune,
        diseaseScore.breakdown.gut,
        diseaseScore.breakdown.lifestyle,
        JSON.stringify(diseaseScore.breakdown)
      ]
    );

    res.json({
      pai_score: diseaseScore.score,
      breakdown: diseaseScore.breakdown,
      recent_symptoms: recentSymptoms.length,
      calculated_at: new Date()
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
