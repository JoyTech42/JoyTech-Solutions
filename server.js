const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Middleware for Admin Pass Validation
const checkAdmin = (req, res, next) => {
    const incomingPass = req.headers['x-admin-password'];
    const adminPass = (process.env.ADMIN_PASSWORD || 'JoyTechAdmin2026').trim();
    if (incomingPass && incomingPass.trim() === adminPass) return next();
    return res.status(401).json({ error: "Unauthorized access." });
};

// --- API ENDPOINTS ---

// Public submission route from index.html
app.post('/api/quote', async (req, res) => {
    const { name, email, message } = req.body;
    if (!name || !email || !message) {
        return res.status(400).json({ error: "All fields are required." });
    }
    try {
        await pool.query(
            'INSERT INTO quote_requests (name, email, message) VALUES ($1, $2, $3)', 
            [name, email, message]
        );
        res.status(201).json({ success: true, message: "Request received successfully!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin stats validation
app.get('/api/admin/stats', checkAdmin, async (req, res) => {
    try {
        const total = await pool.query('SELECT COUNT(*) FROM quote_requests');
        res.json({ totalRequests: total.rows[0].count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Retrieve entries for admin panel dashboard
app.get('/api/messages', checkAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM quote_requests ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete individual entry
app.delete('/api/requests/:id', checkAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM quote_requests WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Catch-all route to serve index.html for root path
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => console.log(`🚀 JoyTech Solutions active on port: ${PORT}`));
