const express = require("express");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
app.use(cors());
app.use(bodyParser.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const JWT_SECRET = "supersecret"; // потом заменим

// --- Healthcheck ---
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// --- Registration ---
app.post("/api/auth/register", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: "Email and password required" });

  try {
    const exists = await pool.query(
      "SELECT id FROM users WHERE email=$1",
      [email]
    );

    if (exists.rows.length > 0)
      return res.status(400).json({ error: "User already exists" });

    const result = await pool.query(
      "INSERT INTO users(email,password) VALUES($1,$2) RETURNING id",
      [email, password]
    );

    const token = jwt.sign({ id: result.rows[0].id }, JWT_SECRET);

    res.status(201).json({ token });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

// --- Login ---
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query(
      "SELECT id,password FROM users WHERE email=$1",
      [email]
    );

    if (result.rows.length === 0)
      return res.status(400).json({ error: "User not found" });

    if (result.rows[0].password !== password)
      return res.status(400).json({ error: "Wrong password" });

    const token = jwt.sign({ id: result.rows[0].id }, JWT_SECRET);

    res.json({ token });
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

// --- Auth middleware ---
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "No token" });

  const token = header.split(" ")[1];

  try {
    const user = jwt.verify(token, JWT_SECRET);
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

// --- Profile ---
app.get("/api/profile", auth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id,email FROM users WHERE id=$1",
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server running on port", PORT));
