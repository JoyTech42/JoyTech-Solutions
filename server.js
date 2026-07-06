const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
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

// Forgot Password Route (Direct Display Fix - No Third-Party Email Services Needed)
app.post('/api/auth/forgot-password', async (req, res) => {
    const { email } = req.body;
    console.log(`[DEBUG] Attempting reset for: ${email}`);
    
    try {
        // 1. Verify user exists in Neon database console
        const user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        
        if (user.rows.length === 0) {
            console.log(`[DEBUG] Email not found in DB.`);
            return res.status(404).json({ error: "Email address not registered." });
        }

        // 2. Generate secure reset tokens
        const token = crypto.randomBytes(32).toString('hex');
        const expiry = new Date(Date.now() + 3600000); // 1 hour link validity

        await pool.query(
            'UPDATE users SET reset_token = $1, reset_expiry = $2 WHERE email = $3',
            [token, expiry, email]
        );

        const resetLink = `https://joytech-solutions-84ca.onrender.com/reset-password?token=${token}`;
        
        // 3. Print to your Render terminal dashboard for admin visibility
        console.log(`[SECURITY LOG] Reset Link generated for ${email}: ${resetLink}`);
        
        // 4. Return it straight to your frontend view to eliminate any timeout hang
        res.json({ message: `Reset Link Generated! Click here to update: ${resetLink}` });
        
    } catch (err) {
        console.error("[CRITICAL ERROR] Password reset process failed:", err.message);
        res.status(500).json({ error: "Failed to process password reset request." });
    }
});

// NEW POST: Execute and save the adjusted password changes
app.post('/api/auth/reset-password', async (req, res) => {
    const { token, password } = req.body;
    
    try {
        if (!token || !password) {
            return res.status(400).json({ error: "Missing required token or password data fields." });
        }

        // 1. Look for user matching this reset token where it hasn't expired yet
        const result = await pool.query(
            'SELECT * FROM users WHERE reset_token = $1 AND reset_expiry > NOW()',
            [token]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: "Security reset link is invalid or has expired." });
        }

        const user = result.rows[0];

        // 2. Safely encrypt the brand new user password via bcrypt
        const hashedPassword = await bcrypt.hash(password, 10);

        // 3. Update the credentials and clear out the token fields to prevent reuse attacks
        await pool.query(
            'UPDATE users SET password_hash = $1, reset_token = NULL, reset_expiry = NULL WHERE id = $2',
            [hashedPassword, user.id]
        );

        res.json({ message: "Password updated successfully!" });

    } catch (err) {
        console.error("[CRITICAL ERROR] Reset token processing crashed:", err);
        res.status(500).json({ error: "Internal database update exception occurred." });
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
