const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'joytech_solutions_cosmic_key_2026';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

app.use(express.json());
app.use(express.static(__dirname));

// Routes
app.post('/api/auth/signup', async (req, res) => {
    try {
        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        await pool.query('INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)', 
        [req.body.name || 'User', req.body.email, hashedPassword]);
        res.status(201).json({ success: true });
    } catch (err) { res.status(500).json({ error: "Signup failed." }); }
});

app.post('/api/auth/signin', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [req.body.email]);
        if (result.rows.length === 0) return res.status(401).json({ error: "Invalid credentials." });
        const match = await bcrypt.compare(req.body.password, result.rows[0].password_hash);
        if (!match) return res.status(401).json({ error: "Invalid credentials." });
        const token = jwt.sign({ id: result.rows[0].id }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token });
    } catch (err) { res.status(500).json({ error: "System error." }); }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, () => console.log(`JoyTech Engine Online on ${PORT}`));
