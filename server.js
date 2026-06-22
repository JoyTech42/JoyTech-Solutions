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

const checkAdmin = (req, res, next) => {
    const adminPass = (process.env.ADMIN_PASSWORD || 'JoyTechAdmin2026').trim();
    if (req.headers['x-admin-password'] === adminPass) return next();
    res.status(401).json({ error: "Unauthorized" });
};

app.get('/api/messages', checkAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM quote_requests ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/requests', async (req, res) => {
    const { name, email, service, message } = req.body;
    try {
        await pool.query('INSERT INTO quote_requests (name, email, service, message) VALUES ($1, $2, $3, $4)', 
            [name, email, service, message]);
        res.status(201).json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/requests/:id', checkAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM quote_requests WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(PORT, () => console.log(`JoyTech Solutions active on port ${PORT}`));
