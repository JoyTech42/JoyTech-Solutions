const express = require('express');
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to Neon PostgreSQL Database
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Required for secure Neon connection
});

// Middleware to read JSON data and serve static files
app.use(express.json());
app.use(express.static(__dirname));

// --------------------------------------------------------
// AUTHENTICATION MIDDLEWARE (The Security Gate)
// --------------------------------------------------------
function checkAdminPassword(req, res, next) {
    const clientPassword = req.headers['x-admin-password'];
    const correctPassword = process.env.ADMIN_PASSWORD || "JoyTech2026"; // Fallback password

    if (clientPassword === correctPassword) {
        next(); // Password matches! Move to the next step.
    } else {
        res.status(401).json({ error: "Unauthorized access. Wrong password." });
    }
}

// --------------------------------------------------------
// PUBLIC ROUTE: Customers sending messages from index.html
// --------------------------------------------------------
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

// --------------------------------------------------------
// SECURE ROUTES: Protected by the checkAdminPassword gate
// --------------------------------------------------------

// 1. Get total system request stats
app.get('/api/admin/stats', checkAdminPassword, async (req, res) => {
    try {
        const result = await pool.query('SELECT COUNT(*) FROM requests');
        const count = parseInt(result.rows[0].count, 10);
        res.json({ totalRequests: count });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Could not fetch stats." });
    }
});

// 2. Get all client messages for the dashboard list
app.get('/api/messages', checkAdminPassword, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM requests ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Could not fetch messages." });
    }
});

// 3. Delete a client request entry completely
app.delete('/api/requests/:id', checkAdminPassword, async (req, res) => {
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
