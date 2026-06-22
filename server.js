const express = require('express');
const { Pool } = require('pg');
const app = express();
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const checkAdminPassword = (req, res, next) => {
    const incoming = req.headers['x-admin-password'];
    const system = (process.env.ADMIN_PASSWORD || 'JoyTechAdmin2026').trim();
    if (incoming && incoming.trim() === system) return next();
    return res.status(401).json({ error: "Password is not correct." });
};

app.get('/api/admin/stats', checkAdminPassword, async (req, res) => {
    try {
        const total = await pool.query('SELECT COUNT(*) FROM quote_requests');
        res.json({ totalRequests: total.rows[0].count });
    } catch (err) {
        res.status(500).json({ error: "DB Query Failed: " + err.message });
    }
});

app.get('/api/messages', checkAdminPassword, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM quote_requests ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "DB Query Failed: " + err.message });
    }
});
