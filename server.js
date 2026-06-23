const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Connects to your Neon database
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Checks if admin password is correct
const checkAdmin = (req, res, next) => {
    const incomingPass = req.headers['x-admin-password'];
    const adminPass = (process.env.ADMIN_PASSWORD || 'JoyTechAdmin2026').trim();
    if (incomingPass && incomingPass.trim() === adminPass) return next();
    return res.status(401).json({ error: "Wrong Password." });
};

// Route 1: Receives form data from index.html
app.post('/api/quote', async (req, res) => {
    const { name, email, message } = req.body;
    try {
        await pool.query(
            'INSERT INTO quote_requests (name, email, message) VALUES ($1, $2, $3)', 
            [name, email, message]
        );
        res.status(201).json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Route 2: Gets total numbers for the admin banner
app.get('/api/admin/stats', checkAdmin, async (req, res) => {
    try {
        const total = await pool.query('SELECT COUNT(*) FROM quote_requests');
        res.json({ totalRequests: total.rows[0].count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Route 3: Loads all messages into the admin list
app.get('/api/messages', checkAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM quote_requests ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Route 4: Deletes a row when you click delete
app.delete('/api/requests/:id', checkAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM quote_requests WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Serves the homepage automatically
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => console.log(`JoyTech Server running on port ${PORT}`));
