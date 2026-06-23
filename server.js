const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'joytech_solutions_cosmic_key_2026';

// Connect to Neon PostgreSQL Database
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

app.use(express.json());
app.use(express.static(__dirname));

// PUBLIC ROUTE: Customer Message Form Intake (No Auth Needed)
app.post('/api/quote', async (req, res) => {
    const { name, email, service, message } = req.body;
    if (!name || !email || !message) {
        return res.status(400).json({ error: "Please fill in all required fields." });
    }
    try {
        const queryText = 'INSERT INTO requests (name, email, service, message) VALUES ($1, $2, $3, $4) RETURNING *';
        const values = [name, email, service, message];
        const result = await pool.query(queryText, values);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error("Form Capture Error:", err);
        res.status(500).json({ error: "Could not save message pipeline entry." });
    }
});

// AUTHENTICATION: Sign Up Route (Creates Secure Hashed Account)
app.post('/api/auth/signup', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ error: "All registration fields are required." });
    }
    try {
        // Hash password securely before database entry
        const hashedPassword = await bcrypt.hash(password, 10);
        const queryText = 'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email';
        const result = await pool.query(queryText, [name, email, hashedPassword]);
        res.status(201).json({ success: true, user: result.rows[0] });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ error: "An account with this email already exists." });
        }
        console.error(err);
        res.status(500).json({ error: "Account creation breakdown." });
    }
});

// AUTHENTICATION: Sign In Route (Validates Credentials & Signs Token)
app.post('/api/auth/signin', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required." });
    }
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: "Invalid login credentials details." });
        }

        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(401).json({ error: "Invalid login credentials details." });
        }

        // Generate dynamic secure runtime session token
        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ success: true, token });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Sign in configuration failure." });
    }
});

// ROUTE PROTECTION MIDDLEWARE
const verifyAdminToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: "Session security token missing." });

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ error: "Session expired. Re-authenticate." });
        req.user = decoded;
        next();
    });
};

// SECURED PIPELINE ENDPOINTS
app.get('/api/admin/stats', verifyAdminToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT COUNT(*) FROM requests');
        res.json({ totalRequests: parseInt(result.rows[0].count, 10) });
    } catch (err) {
        res.status(500).json({ error: "Telemetry sync error." });
    }
});

app.get('/api/messages', verifyAdminToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM requests ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Database reading failure." });
    }
});

app.delete('/api/requests/:id', verifyAdminToken, async (req, res) => {
    try {
        await pool.query('DELETE FROM requests WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Row deletion error." });
    }
});

// Fallback Route: Directs traffic to home base index dashboard view
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`JoyTech Solutions Engine online and fully guarded on port ${PORT}`);
});
