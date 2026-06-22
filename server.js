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

// Admin Auth Middleware
const checkAdminPassword = (req, res, next) => {
    const incomingPassword = req.headers['x-admin-password'];
    const systemPassword = (process.env.ADMIN_PASSWORD || 'JoyTechAdmin2026').trim();

    if (incomingPassword && incomingPassword.trim() === systemPassword) {
        return next();
    }
    return res.status(401).json({ error: "Unauthorized" });
};

// Stats Route: Uses quote_requests table
app.get('/api/admin/stats', checkAdminPassword, async (req, res) => {
    try {
        const total = await pool.query('SELECT COUNT(*) FROM quote_requests');
        const unpaid = await pool.query("SELECT COUNT(*) FROM quote_requests WHERE payment_status = 'Pending'");
        res.json({ totalRequests: total.rows[0].count, pendingPayments: unpaid.rows[0].count });
    } catch (err) {
        res.status(500).json({ error: "DB Error" });
    }
});

// Messages Route: Uses quote_requests table
app.get('/api/messages', checkAdminPassword, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM quote_requests ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "DB Error" });
    }
});

app.get('/admin.html', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.listen(PORT, () => console.log(`🚀 Active on port: ${PORT}`));
