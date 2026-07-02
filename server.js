const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
require('dotenv').config();

// 1. Initialize App
const app = express();
app.use(express.json());
app.use(express.static(__dirname));

// 2. Database connection
const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// 3. Configure Nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// --- ROUTES ---

// Sign Up
app.post('/api/auth/signup', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query(
            'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)',
            [name || 'Customer', email, hashedPassword]
        );
        res.status(201).json({ success: true, message: "User created" });
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: "Email already registered." });
        res.status(500).json({ error: "Registration failed." });
    }
});

// Sign In
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

// Forgot Password
app.post('/api/auth/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (user.rows.length === 0) {
            return res.json({ message: "If an account exists, a reset link has been sent." });
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expiry = new Date(Date.now() + 3600000); // 1 hour

        await pool.query(
            'UPDATE users SET reset_token = $1, reset_expiry = $2 WHERE email = $3',
            [token, expiry, email]
        );

        const resetLink = `https://your-domain.com/reset-password?token=${token}`;
       // Change this part in your forgot-password route
await transporter.sendMail({
    // Use the format: "Display Name" <email@address.com>
    from: '"JoyTech Solutions Support" <your-actual-email@gmail.com>', 
    to: email,
    subject: 'Password Reset Request',
    text: `You requested a password reset. Click here to reset: ${resetLink}`
});

        res.json({ message: "If an account exists, a reset link has been sent." });
    } catch (err) {
        res.status(500).json({ error: "Failed to process request." });
    }
});

// Request Quote
app.post('/api/quote', async (req, res) => {
    try {
        await pool.query('INSERT INTO requests (name, email, service, message) VALUES ($1, $2, $3, $4)', 
        [req.body.name, req.body.email, req.body.service, req.body.message]);
        res.status(201).json({ success: true, message: "Message sent successfully" });
    } catch (err) {
        res.status(500).json({ error: "Failed to send message." });
    }
});

// Default
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
