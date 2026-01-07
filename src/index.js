import express from "express";
import pg from "pg";
import bodyParser from "body-parser";

const app = express();
app.use(bodyParser.json());

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
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });

  try {
    const client = await pool.connect();
    const result = await client.query(
      "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email",
      [email, password]
    );
    client.release();

    res.json({
      message: "User registered",
      user: result.rows[0],
      token: "fake-jwt-token-for-testing"
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get user profile
app.get("/profile/:userId", async (req, res) => {
  const { userId } = req.params;
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
app.post("/records", async (req, res) => {
  const { userId, type, details } = req.body;
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
app.get("/records/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const client = await pool.connect();
    const result = await client.query(
      "SELECT id, user_id, type, details FROM records WHERE user_id = $1",
      [userId]
    );
    client.release();

    res.json({ records: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log("Server started on port", PORT);
});
