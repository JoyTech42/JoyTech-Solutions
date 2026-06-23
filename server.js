const express = require('express');
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Connect directly to your Neon PostgreSQL Database Cluster
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

app.use(express.json());
app.use(express.static(__dirname));

// Public Route: Saves customer submissions directly from index.html
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

// Unprotected Admin Routes: Open telemetry and message processing
app.get('/api/admin/stats', async (req, res) => {
    try {
        const result = await pool.query('SELECT COUNT(*) FROM requests');
        res.json({ totalRequests: parseInt(result.rows[0].count, 10) });
    } catch (err) {
        res.status(500).json({ error: "Could not fetch stats cluster." });
    }
});

app.get('/api/messages', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM requests ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Could not read data lines." });
    }
});

app.delete('/api/requests/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM requests WHERE id = $1', [req.params.id]);
        res.json({ success: true, message: `Record deleted.` });
    } catch (err) {
        res.status(500).json({ error: "Could not delete row." });
    }
});

// Default Fallback: Points all primary root navigation directly to index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`JoyTech Solutions Engine running completely open on port ${PORT}`);
});
