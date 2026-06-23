const express = require('express');
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to Neon PostgreSQL Database
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Middleware to read JSON data and serve static files
app.use(express.json());
app.use(express.static(__dirname));

// Public Route: Customers sending messages from index.html
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

// Open Admin Routes (Direct access, no authentication checks)
app.get('/api/admin/stats', async (req, res) => {
    try {
        const result = await pool.query('SELECT COUNT(*) FROM requests');
        const count = parseInt(result.rows[0].count, 10);
        res.json({ totalRequests: count });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Could not fetch stats." });
    }
});

app.get('/api/messages', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM requests ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Could not fetch messages." });
    }
});

app.delete('/api/requests/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM requests WHERE id = $1', [id]);
        res.json({ success: true, message: `Request ${id} deleted.` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Could not delete row." });
    }
});

// Fallback: Send index.html if user navigates to root URL
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server engine
app.listen(PORT, () => {
    console.log(`JoyTech Server running perfectly on port ${PORT}`);
});
