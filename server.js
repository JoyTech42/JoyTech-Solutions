const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'joytech_solutions_cosmic_key_2026';

// 1. Database Connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

app.use(express.json());
app.use(express.static(__dirname));

// 2. Public Client Contact Form Pipeline
app.post('/api/quote', async (req, res) => {
    const { name, email, service, message } = req.body;
    
    if (!name || !email || !service || !message) {
        return res.status(400).json({ error: "All fields are required." });
    }
    
    try {
        const queryText = 'INSERT INTO requests (name, email, service, message) VALUES ($1, $2, $3, $4) RETURNING *';
        const result = await pool.query(queryText, [name, email, service, message]);
        return res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error("Database Error:", err.message);
        return res.status(500).json({ error: "Database operation failed." });
    }
});

// 3. Admin Access Route
app.get('/admin', (req, res) => {
    // Serves the single-page application index.html
    return res.sendFile(path.join(__dirname, 'index.html'));
});

// 4. Authentication Endpoints
app.post('/api/auth/signup', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, email',
            [name, email, hashedPassword]
        );
        return res.status(201).json({ success: true, user: result.rows[0] });
    } catch (err) {
        console.error("Signup Error:", err.message);
        return res.status(500).json({ error: "Signup failed (Email may already exist)." });
    }
});

app.post('/api/auth/signin', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) return res.status(401).json({ error: "Invalid credentials." });

        const match = await bcrypt.compare(password, result.rows[0].password_hash);
        if (!match) return res.status(401).json({ error: "Invalid credentials." });

        const token = jwt.sign({ id: result.rows[0].id }, JWT_SECRET, { expiresIn: '24h' });
        return res.json({ success: true, token });
    } catch (err) {
        return res.status(500).json({ error: "Authentication system error." });
    }
});

// 5. Security Middleware
const secureGuard = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: "Access denied." });

    jwt.verify(token, JWT_SECRET, (err, decodedUser) => {
        if (err) return res.status(403).json({ error: "Session expired." });
        req.user = decodedUser;
        next();
    });
};

// 6. Admin API Endpoints
app.get('/api/admin/stats', secureGuard, async (req, res) => {
    try {
        const result = await pool.query('SELECT COUNT(*) FROM requests');
        return res.json({ totalRequests: parseInt(result.rows[0].count, 10) });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.get('/api/messages', secureGuard, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM requests ORDER BY id DESC');
        return res.json(result.rows);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.delete('/api/requests/:id', secureGuard, async (req, res) => {
    try {
        await pool.query('DELETE FROM requests WHERE id = $1', [req.params.id]);
        return res.json({ success: true, message: "Record deleted." });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// 7. Fallback Route
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
    console.log(`JoyTech Server running on port ${PORT}`);
});
