const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

// Ensure DATABASE_URL is set in Render Environment settings
const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Helps with Render/Neon connections
});

// 1. Sign Up Route (Essential to create the user first!)
app.post('/api/auth/signup', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query(
            'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)',
            [name, email, hashedPassword]
        );
        res.status(201).json({ success: true, message: "User created" });
    } catch (err) {
        console.error("SIGNUP ERROR:", err);
        res.status(500).json({ error: "Failed to create user." });
    }
});

// 2. Sign In Route
app.post('/api/auth/signin', async (req, res) => {
    const { email, password } = req.body;
    try {
        console.log("Checking user:", email);
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        
        if (result.rows.length === 0) {
            console.log("User not found.");
            return res.status(401).json({ error: "User not found" });
        }

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            console.log("Password mismatch.");
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.json({ token });
    } catch (err) {
        console.error("SIGNIN ERROR:", err);
        res.status(500).json({ error: "Internal server error", details: err.message });
    }
});

// 3. Request Quote Route
app.post('/api/quote', async (req, res) => {
    try {
        await pool.query('INSERT INTO requests (name, email, service, message) VALUES ($1, $2, $3, $4)', 
        [req.body.name, req.body.email, req.body.service, req.body.message]);
        res.status(201).json({ success: true });
    } catch (err) {
        console.error("QUOTE ERROR:", err);
        res.status(500).json({ error: "Failed." });
    }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
