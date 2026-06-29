const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.post('/api/quote', async (req, res) => {
    try {
        await pool.query('INSERT INTO requests (name, email, service, message) VALUES ($1, $2, $3, $4)', 
        [req.body.name, req.body.email, req.body.service, req.body.message]);
        res.status(201).json({ success: true });
    } catch (err) { res.status(500).json({ error: "Failed." }); }
});

app.post('/api/auth/signin', async (req, res) => {
    // ... Logic to check DB and return JWT token
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.listen(3000);
