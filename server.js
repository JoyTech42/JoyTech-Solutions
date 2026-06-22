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

// Middleware: Strict Admin Security
const checkAdmin = (req, res, next) => {
    const incoming = req.headers['x-admin-password'];
    const adminPass = (process.env.ADMIN_PASSWORD || 'JoyTechAdmin2026').trim();
    if (incoming && incoming.trim() === adminPass) return next();
    return res.status(401).json({ error: "Unauthorized access." });
};

// --- ROUTES ---

// 1. Dashboard Statistics
app.get('/api/admin/stats', checkAdmin, async (req, res) => {
    try {
        const total = await pool.query('SELECT COUNT(*) FROM quote_requests');
        res.json({ totalRequests: total.rows[0].count });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. Get All Entries
app.get('/api/messages', checkAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM quote_requests ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 3. Create New Entry (Adding Service/Request)
app.post('/api/requests', checkAdmin, async (req, res) => {
    const { name, email, service, message } = req.body;
    try {
        await pool.query('INSERT INTO quote_requests (name, email, service, message) VALUES ($1, $2, $3, $4)', 
            [name, email, service, message]);
        res.status(201).json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 4. Delete Entry
app.delete('/api/requests/:id', checkAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM quote_requests WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(PORT, () => console.log(`🚀 Professional Portal Engine Active: ${PORT}`));
