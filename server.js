const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
require('dotenv').config();

const app = express();
app.use(express.json());

// Database connection
const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000 
});

// --- API ROUTES ---
// (Your existing routes remain unchanged)
app.post('/api/auth/signup', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query('INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)', [name || 'Customer', email, hashedPassword]);
        res.status(201).json({ success: true, message: "User created" });
    } catch (err) {
        console.error("Signup Error:", err);
        res.status(500).json({ error: "Registration failed." });
    }
});

app.post('/api/auth/signin', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) return res.status(401).json({ error: "User not found" });
        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });
        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.json({ token });
    } catch (err) {
        res.status(500).json({ error: "Authentication failed." });
    }
});

app.post('/api/auth/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (user.rows.length === 0) return res.status(404).json({ error: "Email not registered." });
        const token = crypto.randomBytes(32).toString('hex');
        const expiry = new Date(Date.now() + 3600000);
        await pool.query('UPDATE users SET reset_token = $1, reset_expiry = $2 WHERE email = $3', [token, expiry, email]);
        const resetLink = `https://joytech-solutions-84ca.onrender.com/reset-password?token=${token}`;
        res.json({ message: `Reset Link Generated! Click here: ${resetLink}` });
    } catch (err) {
        res.status(500).json({ error: "Failed to process request." });
    }
});

app.post('/api/auth/reset-password', async (req, res) => {
    const { token, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE reset_token = $1 AND reset_expiry > NOW()', [token]);
        if (result.rows.length === 0) return res.status(400).json({ error: "Invalid/Expired token." });
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query('UPDATE users SET password_hash = $1, reset_token = NULL, reset_expiry = NULL WHERE id = $2', [hashedPassword, result.rows[0].id]);
        res.json({ message: "Password updated successfully!" });
    } catch (err) {
        res.status(500).json({ error: "Database error." });
    }
});

app.post('/api/quote', async (req, res) => {
    try {
        await pool.query('INSERT INTO requests (name, email, service, message) VALUES ($1, $2, $3, $4)', [req.body.name, req.body.email, req.body.service, req.body.message]);
        res.status(201).json({ success: true, message: "Message sent!" });
    } catch (err) {
        res.status(500).json({ error: "Failed to send message." });
    }
});

// --- SAFE FRONTEND ROUTING ---
// Define the folder where your index.html lives (e.g., 'public' or 'dist')
const frontendDir = path.join(__dirname, 'public'); 

if (fs.existsSync(frontendDir)) {
    console.log("✅ Frontend folder found, serving static files...");
    app.use(express.static(frontendDir));
    app.get('*', (req, res) => {
        res.sendFile(path.join(frontendDir, 'index.html'));
    });
} else {
    console.warn("⚠️ Warning: 'public' folder not found! API is running, but no frontend will be served.");
    app.get('/', (req, res) => res.send("<h1>Server Operational</h1><p>API is active. Frontend files not found in /public.</p>"));
}

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
