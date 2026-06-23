const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const jwt = require('jsonwebtoken'); // Run: npm install jsonwebtoken
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'joytech_secret_system_key';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

app.use(express.json());
app.use(express.static(__dirname));

// Public Route: Customers submitting messages from index.html (No Auth)
app.post('/api/quote', async (req, res) => {
    const { name, email, service, message } = req.body;
    if (!name || !email || !message) {
        return res.status(400).json({ error: "All fields are required." });
    }
    try {
        const result = await pool.query(
            'INSERT INTO requests (name, email, service, message) VALUES ($1, $2, $3, $4) RETURNING *',
            [name, email, service || 'General Help', message]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to save request." });
    }
});

// Admin Authentication Route
app.post('/api/admin/login', (req, res) => {
    const { email, password } = req.body;
    
    // Matches your environmental credentials
    if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
        const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
        return res.json({ success: true, token });
    }
    
    res.status(401).json({ error: "Invalid administrative credentials." });
});

// Middleware to protect private data routes
const verifyAdminToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: "Access denied." });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: "Session expired." });
        req.user = user;
        next();
    });
};

// Protected Data Routes for admin.html
app.get('/api/admin/stats', verifyAdminToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT COUNT(*) FROM requests');
        res.json({ totalRequests: parseInt(result.rows[0].count, 10) });
    } catch (err) {
        res.status(500).json({ error: "Database error." });
    }
});

app.get('/api/messages', verifyAdminToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM requests ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Database error." });
    }
});

app.delete('/api/requests/:id', verifyAdminToken, async (req, res) => {
    try {
        await pool.query('DELETE FROM requests WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Database error." });
    }
});

// Default: Public falls directly back to index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`JoyTech Solutions Engine online on port ${PORT}`);
});
