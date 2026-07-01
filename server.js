const nodemailer = require('nodemailer');
const crypto = require('crypto');

// ... keep your existing code above ...

// Configure Nodemailer (Add this near your other const definitions)
const transporter = nodemailer.createTransport({
    service: 'gmail', // Or your email provider
    auth: {
        user: process.env.EMAIL_USER, // Add these to your .env file
        pass: process.env.EMAIL_PASS  // Use an App Password (not your real password)
    }
});

// The New Forgot Password Route
app.post('/api/auth/forgot-password', async (req, res) => {
    const { email } = req.body;

    try {
        // 1. Check if user exists
        const user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (user.rows.length === 0) {
            // We return success even if user not found for security (prevents email enumeration)
            return res.json({ message: "If an account exists, a reset link has been sent." });
        }

        // 2. Generate a secure token
        const token = crypto.randomBytes(32).toString('hex');
        const expiry = new Date(Date.now() + 3600000); // 1 hour from now

        // 3. Save token to DB
        await pool.query(
            'UPDATE users SET reset_token = $1, reset_expiry = $2 WHERE email = $3',
            [token, expiry, email]
        );

        // 4. Send Email
        const resetLink = `https://your-domain.com/reset-password?token=${token}`;
        
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Password Reset Request',
            text: `You requested a password reset. Click here to reset: ${resetLink}`
        });

        res.json({ message: "If an account exists, a reset link has been sent." });
    } catch (err) {
        console.error("FORGOT PASSWORD ERROR:", err);
        res.status(500).json({ error: "Failed to process request." });
    }
});
