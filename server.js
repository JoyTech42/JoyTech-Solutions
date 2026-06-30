const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Sign Up Route
app.post('/api/auth/signup', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        // Use a default name if it's missing to avoid "Not Null" errors
        const displayName = name || 'Customer'; 
        
        await pool.query(
            'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)',
            [displayName, email, hashedPassword]
        );
        res.status(201).json({ success: true, message: "User created" });
    } catch (err) {
        console.error("SIGNUP ERROR:", err);
        res.status(500).json({ error: "Failed to create user: " + err.message });
    }
});

// Sign In Route
app.post('/api/auth/signin', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: "User not found" });
        }

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        // Safety check for JWT_SECRET
        if (!process.env.JWT_SECRET) {
            throw new Error("Server configuration error: JWT_SECRET missing");
        }

        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.json({ token });
    } catch (err) {
        console.error("SIGNIN ERROR:", err);
        res.status(500).json({ error: "Authentication failed", details: err.message });
    }
});

// Request Route
app.post('/api/quote', async (req, res) => {
    try {
        await pool.query('INSERT INTO requests (name, email, service, message) VALUES ($1, $2, $3, $4)', 
        [req.body.name, req.body.email, req.body.service, req.body.message]);
        res.status(201).json({ success: true });
    } catch (err) {
        console.error("QUOTE ERROR:", err);
        res.status(500).json({ error: "Failed to send message." });
    }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
