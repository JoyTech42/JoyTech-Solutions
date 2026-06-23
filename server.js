const express = require('express');
const { Pool } = require('pg');
const path = require('path');
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

// PUBLIC ROUTE: Customers sending messages from index.html (No Auth Required)
app.post('/api/quote', async (req, res) => {
    const { name, email, service, message } = req.body;
    if (!name || !email || !message) {
        return res.status(400).json({ error: "Please fill in all required fields." });
    }
    try {
        const queryText = 'INSERT INTO requests (name, email, service, message) VALUES ($1, $2, $3, $4) RETURNING *';
        const values = [name, email, service || 'General Help', message];
        const result = await pool.query(queryText, values);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error("Database Error:", err);
        res.status(500).json({ error: "Server could not save the message." });
    }
});

// ADMIN AUTHENTICATION: Validates credentials and returns an access token
app.post('/api/admin/login', (req, res) => {
    const { email, password } = req.body;

    // Pulls credentials securely from your environment variables
    if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
        const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
        return res.json({ success: true, token });
    }

    res.status(401).json({ error: "Invalid administrative credentials." });
});

// SECURITY MIDDLEWARE: Verifies incoming JWT tokens before granting database access
const verifyAdminToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: "Access denied. Authentication token missing." });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: "Session expired or invalid token." });
        }
        req.user = decoded;
        next();
    });
};

// PROTECTED ADMIN ROUTES: Locked down with the security middleware
app.get('/api/admin/stats', verifyAdminToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT COUNT(*) FROM requests');
        res.json({ totalRequests: parseInt(result.rows[0].count, 10) });
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch stats cluster." });
    }
});

app.get('/api/messages', verifyAdminToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM requests ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Failed to read data lines." });
    }
});

app.delete('/api/requests/:id', verifyAdminToken, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM requests WHERE id = $1', [id]);
        res.json({ success: true, message: `Record ${id} cleared.` });
    } catch (err) {
        res.status(500).json({ error: "Failed to drop entry row." });
    }
});

// FALLBACK: Serves your open-access index page for all base web navigation
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`JoyTech Solutions Engine online and fully guarded on port ${PORT}`);
});
