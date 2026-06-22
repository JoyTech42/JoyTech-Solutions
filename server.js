const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Core Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname))); // Serves static assets directly from flat root folder

// Neon Console Database Connection Pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Admin Password Gatekeeping Middleware
const checkAdminPassword = (req, res, next) => {
    const incomingPassword = req.headers['x-admin-password'];
    const systemPassword = (process.env.ADMIN_PASSWORD || 'JoyTechAdmin2026').trim();

    if (incomingPassword && incomingPassword.trim() === systemPassword) {
        return next();
    }
    return res.status(401).json({ error: "Login Failed. Password is not correct." });
};

// --- CUSTOMER QUOTE SUBMISSIONS PIPELINE ---
app.post('/api/quote', async (req, res) => {
    const { name, email, service, message } = req.body;
    if (!name || !email || !service || !message) {
        return res.status(400).json({ error: 'All fields are required.' });
    }
    try {
        // Corrected to insert into your true Neon table: 'quote_requests'
        await pool.query(
            'INSERT INTO quote_requests (name, email, service, message, status, payment_status) VALUES ($1, $2, $3, $4, $5, $6)',
            [name, email, service, message, 'New Inquiry', 'Pending']
        );
        res.status(200).json({ success: true });
    } catch (err) {
        console.error("Submission Error:", err.message);
        res.status(500).json({ error: "Database failed to save customer record." });
    }
});

// --- ADMIN CONTROL METRICS & COUNTERS ---
app.get('/api/admin/stats', checkAdminPassword, async (req, res) => {
    try {
        const totalReqs = await pool.query('SELECT COUNT(*) FROM quote_requests');
        const pendingPay = await pool.query("SELECT COUNT(*) FROM quote_requests WHERE payment_status = 'Pending'");
        const activeServ = await pool.query('SELECT COUNT(*) FROM services');
        const pendingTasks = await pool.query('SELECT COUNT(*) FROM admin_tasks WHERE is_completed = false');

        res.json({
            totalRequests: parseInt(totalReqs.rows[0].count) || 0,
            pendingPayments: parseInt(pendingPay.rows[0].count) || 0,
            activeServices: parseInt(activeServ.rows[0].count) || 0,
            pendingTasks: parseInt(pendingTasks.rows[0].count) || 0
        });
    } catch (err) {
        res.status(500).json({ error: "Failed to load telemetry metrics statistics." });
    }
});

// --- ADMIN CUSTOMER MESSAGES INBOX ---
app.get('/api/messages', checkAdminPassword, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM quote_requests ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Failed to read database pipeline logs." });
    }
});

app.put('/api/messages/:id/status', checkAdminPassword, async (req, res) => {
    const { id } = req.params;
    const { status, payment_status } = req.body;
    try {
        await pool.query(
            'UPDATE quote_requests SET status = $1, payment_status = $2 WHERE id = $3',
            [status, payment_status, id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to update logs row status." });
    }
});

app.delete('/api/messages/:id', checkAdminPassword, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM quote_requests WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to drop tracking history record." });
    }
});

// --- SHOP TO-DO TASK MANAGEMENT NOTEBOOK ---
app.get('/api/tasks', checkAdminPassword, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM admin_tasks ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Failed to load reminders notepad." });
    }
});

app.post('/api/tasks', checkAdminPassword, async (req, res) => {
    const { task_text } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO admin_tasks (task_text, is_completed) VALUES ($1, false) RETURNING *',
            [task_text]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Failed to register checklist task." });
    }
});

app.put('/api/tasks/:id', checkAdminPassword, async (req, res) => {
    const { id } = req.params;
    const { is_completed } = req.body;
    try {
        await pool.query('UPDATE admin_tasks SET is_completed = $1 WHERE id = $2', [is_completed, id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to toggle item checkbox status." });
    }
});

// --- DYNAMIC LIVE SERVICES PORTFOLIO CONFIGURATIONS ---
app.get('/api/services', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM services ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Failed to load homepage custom cards catalog." });
    }
});

app.post('/api/services', checkAdminPassword, async (req, res) => {
    const { title, description } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO services (title, description) VALUES ($1, $2) RETURNING *',
            [title, description]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Failed to publish service portfolio card." });
    }
});

app.delete('/api/services/:id', checkAdminPassword, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM services WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to delete customized content." });
    }
});

// Fallbacks
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

app.listen(PORT, () => console.log(`🚀 JoyTech Solutions Engine active on port channel: ${PORT}`));
