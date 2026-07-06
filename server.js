const express = require('express');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Configure Database Connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// TEST DATABASE CONNECTION ON STARTUP
pool.query('SELECT 1').then(() => {
    console.log("✅ Database Connected Successfully");
}).catch(err => {
    console.error("❌ Database Connection Failed:", err.message);
});

// Nodemailer Transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// --- AUTH ROUTES ---

// 1. Sign Up
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query('INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)', [name, email, hashedPassword]);
        res.status(201).json({ message: "Account created!" });
    } catch (err) {
        res.status(500).json({ error: "Signup failed (email might exist)." });
    }
});

// 2. Sign In
app.post('/api/auth/signin', async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) return res.status(401).json({ error: "User not found." });
        
        const valid = await bcrypt.compare(password, result.rows[0].password_hash);
        if (!valid) return res.status(401).json({ error: "Invalid password." });
        
        res.json({ token: "fake-jwt-token-for-now" });
    } catch (err) {
        res.status(500).json({ error: "Login error." });
    }
});

// 3. Forgot Password
app.post('/api/auth/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (user.rows.length === 0) return res.status(404).json({ error: "Email not registered." });

        const token = crypto.randomBytes(32).toString('hex');
        const expiry = new Date(Date.now() + 3600000); // 1 hour
        
        await pool.query('UPDATE users SET reset_token = $1, reset_expiry = $2 WHERE email = $3', [token, expiry, email]);

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Password Reset Request',
            html: `<p>Click here to reset your password: <br> 
                   <a href="https://joytech-solutions-84ca.onrender.com/?token=${token}">Reset Password</a></p>`
        });

        res.json({ message: "Success! Check your email." });
    } catch (err) {
        console.error("Forgot Password Error:", err);
        res.status(500).json({ error: "Server error, try again later." });
    }
});

// 4. Reset Password
app.post('/api/auth/reset-password', async (req, res) => {
    const { token, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE reset_token = $1 AND reset_expiry > NOW()', [token]);
        if (result.rows.length === 0) return res.status(400).json({ error: "Invalid or expired token." });
        
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query('UPDATE users SET password_hash = $1, reset_token = NULL, reset_expiry = NULL WHERE id = $2', [hashedPassword, result.rows[0].id]);
        
        res.json({ message: "Password updated successfully!" });
    } catch (err) {
        console.error("Reset Error:", err);
        res.status(500).json({ error: "Failed to update password." });
    }
});

// 5. Quote Submission
app.post('/api/quote', async (req, res) => {
    try {
        const { name, email, service, message } = req.body;
        await pool.query('INSERT INTO submissions (name, email, service, message) VALUES ($1, $2, $3, $4)', [name, email, service, message]);
        res.json({ message: "Request received!" });
    } catch (err) {
        res.status(500).json({ error: "Submission failed." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
