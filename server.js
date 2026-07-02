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

const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// --- ROUTES ---

// Forgot Password Route
app.post('/api/auth/forgot-password', async (req, res) => {
    const { email } = req.body;
    console.log(`[DEBUG] Attempting reset for: ${email}`);
    
    try {
        const user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        
        if (user.rows.length === 0) {
            return res.json({ message: "If an account exists, a reset link has been sent." });
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expiry = new Date(Date.now() + 3600000); 

        await pool.query(
            'UPDATE users SET reset_token = $1, reset_expiry = $2 WHERE email = $3',
            [token, expiry, email]
        );

        const resetLink = `https://joytech-solutions-84ca.onrender.com/reset-password?token=${token}`;
        
        console.log(`[DEBUG] Sending email...`);
        
        await transporter.sendMail({
            from: `"JoyTech Solutions Support" <${process.env.EMAIL_USER}>`, 
            to: email,
            subject: 'Password Reset Request',
            text: `You requested a password reset. Click here to reset: ${resetLink}`
        });

        console.log(`[DEBUG] Email sent successfully.`);
        res.json({ message: "If an account exists, a reset link has been sent." });
    } catch (err) {
        console.error("[CRITICAL ERROR] Failed to send email:", err);
        res.status(500).json({ error: "Failed to process email. Check server logs." });
    }
});

// ... (Other routes remain the same)

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
