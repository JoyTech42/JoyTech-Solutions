const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

// Database connection with a 10-second timeout
const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000 
});

// Configure Nodemailer with Fail-Fast Timeouts and Explicit SMTP
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465, // Use secure port
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    connectionTimeout: 10000, // Fails after 10 seconds instead of hanging
    greetingTimeout: 10000,
    socketTimeout: 10000
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
        console.error("Signup Error:", err);
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
        console.error("Signin Error:", err);
        res.status(500).json({ error: "Authentication failed." });
    }
});

// Forgot Password Route
app.post('/api/auth/forgot-password', async (req, res) => {
    const { email } = req.body;
    console.log(`[DEBUG] Attempting reset for: ${email}`);
    
    try {
        const user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        
        if (user.rows.length === 0) {
            console.log(`[DEBUG] Email not found in DB, returning generic success.`);
            return res.json({ message: "If an account exists, a reset link has been sent." });
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expiry = new Date(Date.now() + 3600000); 

        await pool.query(
            'UPDATE users SET reset_token = $1, reset_expiry = $2 WHERE email = $3',
            [token, expiry, email]
        );

        const resetLink = `https://joytech-solutions-84ca.onrender.com/reset-password?token=${token}`;
        
        console.log(`[DEBUG] Connecting to Gmail to send email...`);
        
        await transporter.sendMail({
            from: `"JoyTech Solutions Support" <${process.env.EMAIL_USER}>`, 
            to: email,
            subject: 'Password Reset Request',
            text: `You requested a password reset. Click here to reset: ${resetLink}`
        });

        console.log(`[DEBUG] Email sent successfully.`);
        res.json({ message: "If an account exists, a reset link has been sent." });
    } catch (err) {
        console.error("[CRITICAL ERROR] Mailer failed:", err.message);
        res.status(500).json({ error: "Failed to connect to email provider. Check Render logs." });
    }
});

// Request Quote
app.post('/api/quote', async (req, res) => {
    try {
        await pool.query('INSERT INTO requests (name, email, service, message) VALUES ($1, $2, $3, $4)', 
        [req.body.name, req.body.email, req.body.service, req.body.message]);
        res.status(201).json({ success: true, message: "Message sent successfully! I'll get to you shortly!" });
    } catch (err) {
        console.error("Quote Error:", err);
        res.status(500).json({ error: "Failed to send message." });
    }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
