const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'joytech_solutions_cosmic_key_2026';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

app.use(express.json());
app.use(express.static(__dirname));

// FIXES CLIENT FORM SUBMISSION: Receives data from form in image_1a17a2.png
app.post('/api/quote', async (req, res) => {
    const { name, email, service, message } = req.body;
    if (!name || !email || !message) {
        return res.status(400).json({ error: "All entry form fields are required." });
    }
    try {
        const queryText = 'INSERT INTO requests (name, email, service, message) VALUES ($1, $2, $3, $4) RETURNING *';
        const values = [name, email, service, message];
        const result = await pool.query(queryText, values);
        return res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error("Pipeline Sync Error:", err);
        return res.status(500).json({ error: "Could not register message into database cluster." });
    }
});

// SMART ROUTER ENTRYPOINT: Determines if owner should Signup or Signin first
app.get('/admin', async (req, res) => {
    try {
        // Check if any row exists in the users table
        const checkUsers = await pool.query('SELECT id FROM users LIMIT 1');
        if (checkUsers.rows.length === 0) {
            // No users exist yet -> Force Signup screen initialization
            return res.sendFile(path.join(__dirname, 'signup.html'));
        }
        // Admin already established -> Proceed straight to Sign In
        return res.sendFile(path.join(__dirname, 'signin.html'));
    } catch (err) {
        // If table doesn't exist yet, serve signup to allow creation
        return res.sendFile(path.join(__dirname, 'signup.html'));
    }
});

// AUTHENTICATION CORE PIPELINES
app.post('/api/auth/signup', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, email',
            [name, email, hashedPassword]
        );
        res.status(201).json({ success: true, user: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: "Account initialization failed." });
    }
});

app.post('/api/auth/signin', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) return res.status(401).json({ error: "Invalid credentials configuration." });

        const match = await bcrypt.compare(password, result.rows[0].password);
        if (!match) return res.status(401).json({ error: "Invalid credentials configuration." });

        const token = jwt.sign({ id: result.rows[0].id }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ success: true, token });
    } catch (err) {
        res.status(500).json({ error: "Authentication system failure." });
    }
});

// PRIVATE CONSOLE API PIPELINES (Token Guarded)
const secureGuard = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ error: "Verification token absent." });
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: "Session invalid." });
        req.user = user;
        next();
    });
};

app.get('/api/admin/stats', secureGuard, async (req, res) => {
    const result = await pool.query('SELECT COUNT(*) FROM requests');
    res.json({ totalRequests: parseInt(result.rows[0].count, 10) });
});

app.get('/api/messages', secureGuard, async (req, res) => {
    const result = await pool.query('SELECT * FROM requests ORDER BY id DESC');
    res.json(result.rows);
});

app.delete('/api/requests/:id', secureGuard, async (req, res) => {
    await pool.query('DELETE FROM requests WHERE id = $1', [req.params.id]);
    res.json({ success: true });
});

// Standard Home Catch-all
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => console.log(`JoyTech Solutions cluster driving on port ${PORT}`));
