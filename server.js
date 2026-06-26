const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'joytech_solutions_cosmic_key_2026';

// 1. Database Connection Cluster Configuration
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

app.use(express.json());
app.use(express.static(__dirname));

// 2. Public Client Contact Form Pipeline
app.post('/api/quote', async (req, res) => {
    const { name, email, service, message } = req.body;
    
    if (!name || !email || !message) {
        return res.status(400).json({ error: "All entry form fields are required." });
    }
    
    try {
        const queryText = 'INSERT INTO requests (name, email, service, message) VALUES ($1, $2, $3, $4) RETURNING *';
        const values = [name, email, service, message];
        const result = await pool.query(queryText, values);
        return res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error("!!! NEON DATABASE REJECTION !!! ->", err.message);
        return res.status(500).json({ error: `Database Failure: ${err.message}` });
    }
});

// 3. Smart Administrative Access Router
app.get('/admin', async (req, res) => {
    try {
        const checkUsers = await pool.query('SELECT id FROM users LIMIT 1');
        
        if (checkUsers.rows.length === 0) {
            return res.sendFile(path.join(__dirname, 'signup.html'));
        }
        return res.sendFile(path.join(__dirname, 'signin.html'));
    } catch (err) {
        console.error("Smart Router Navigation Exception:", err.message);
        return res.sendFile(path.join(__dirname, 'signup.html'));
    }
});

// 4. Authentication Endpoints (FIXED: Using password_hash column)
app.post('/api/auth/signup', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ error: "All registration fields are required." });
    }
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        // Corrected column name from 'password' to 'password_hash'
        const queryText = 'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, email';
        const result = await pool.query(queryText, [name, email, hashedPassword]);
        return res.status(201).json({ success: true, user: result.rows[0] });
    } catch (err) {
        console.error("Signup Error:", err.message);
        return res.status(500).json({ error: `Signup Failed: ${err.message}` });
    }
});

app.post('/api/auth/signin', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required." });
    }
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: "No administrator account matched those details." });
        }

        // Corrected property reference from result.rows[0].password to .password_hash
        const match = await bcrypt.compare(password, result.rows[0].password_hash);
        if (!match) {
            return res.status(401).json({ error: "Incorrect password credentials." });
        }

        const token = jwt.sign({ id: result.rows[0].id }, JWT_SECRET, { expiresIn: '24h' });
        return res.json({ success: true, token });
    } catch (err) {
        console.error("Signin Error:", err.message);
        return res.status(500).json({ error: `Authentication System Error: ${err.message}` });
    }
});

// 5. Session Enforcement Security Middleware
const secureGuard = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: "Access denied. Administrative token missing." });
    }

    jwt.verify(token, JWT_SECRET, (err, decodedUser) => {
        if (err) {
            return res.status(403).json({ error: "Your session expired. Please sign in again." });
        }
        req.user = decodedUser;
        next();
    });
};

// 6. Private Telemetry & Data Management Lines
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
        return res.json({ success: true, message: "Record successfully dropped from database." });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// 7. Global Public Route Fallback
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Engine
app.listen(PORT, () => {
    console.log(`================================================================`);
    console.log(`  JoyTech Solutions Core Engine online on port ${PORT}         `);
    console.log(`  Mode: Smart Admin Routing & Error Diagnostic Level Active    `);
    console.log(`================================================================`);
});
