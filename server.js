const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Core Global Middleware Setup
app.use(cors());
app.use(express.json());

// 2. Database Connection to Neon PostgreSQL Console
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Test the database link immediately upon startup
pool.query('SELECT NOW()', (err, res) => {
    if (err) console.error("❌ Database Connection Error:", err);
    else console.log("✅ Database Connected Successfully to Neon Console.");
});

// 3. Simple Authentication Check Middleware
const checkAdminPassword = (req, res, next) => {
    const incomingPassword = req.headers['x-admin-password'];
    const systemPassword = process.env.ADMIN_PASSWORD || 'JoyTechAdmin2026';

    if (incomingPassword && incomingPassword.trim() === systemPassword.trim()) {
        return next();
    }
    return res.status(401).json({ error: "Login Failed. Password is not correct." });
};

// 4. BUSINESS API ENDPOINTS (Must come BEFORE serving static files)

// --- SYSTEM TELEMETRY STATS ---
app.get('/api/admin/stats', checkAdminPassword, async (req, res) => {
    try {
        const totalReqs = await pool.query('SELECT COUNT(*) FROM messages');
        const pendingPay = await pool.query("SELECT COUNT(*) FROM messages WHERE payment_status = 'Pending'");
        const activeServ = await pool.query('SELECT COUNT(*) FROM services');
        const pendingTasks = await pool.query('SELECT COUNT(*) FROM tasks WHERE is_completed = false');

        res.json({
            totalRequests: parseInt(totalReqs.rows[0].count) || 0,
            pendingPayments: parseInt(pendingPay.rows[0].count) || 0,
            activeServices: parseInt(activeServ.rows[0].count) || 0,
            pendingTasks: parseInt(pendingTasks.rows[0].count) || 0
        });
    } catch (err) {
        res.status(500).json({ error: "Failed to gather telemetry stats." });
    }
});

// --- CUSTOMER MESSAGES / INBOX ---
app.get('/api/messages', checkAdminPassword, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM messages ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch customer logs." });
    }
});

app.post('/api/messages', async (req, res) => {
    const { name, email, service, message } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO messages (name, email, service, message, status, payment_status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [name, email, service, message, 'New Inquiry', 'Pending']
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Failed to post incoming order request." });
    }
});

app.put('/api/messages/:id/status', checkAdminPassword, async (req, res) => {
    const { id } = req.params;
    const { status, payment_status } = req.body;
    try {
        await pool.query(
            'UPDATE messages SET status = $1, payment_status = $2 WHERE id = $3',
            [status, payment_status, id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to update tracking profile." });
    }
});

app.delete('/api/messages/:id', checkAdminPassword, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM messages WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to purge database entry." });
    }
});

// --- SHOP TO-DO NOTEBOOK ---
app.get('/api/tasks', checkAdminPassword, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM tasks ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Failed to read task logs." });
    }
});

app.post('/api/tasks', checkAdminPassword, async (req, res) => {
    const { task_text } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO tasks (task_text, is_completed) VALUES ($1, false) RETURNING *',
            [task_text]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Failed to record task." });
    }
});

app.put('/api/tasks/:id', checkAdminPassword, async (req, res) => {
    const { id } = req.params;
    const { is_completed } = req.body;
    try {
        await pool.query('UPDATE tasks SET is_completed = $1 WHERE id = $2', [is_completed, id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to update task checkbox." });
    }
});

app.delete('/api/tasks/:id', checkAdminPassword, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to clear task." });
    }
});

// --- DYNAMIC HOME PAGE SERVICES ---
app.get('/api/services', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM services ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Failed to load active services list." });
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
        res.status(500).json({ error: "Failed to register custom web card." });
    }
});

app.delete('/api/services/:id', checkAdminPassword, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM services WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to discard custom service instance." });
    }
});

// 5. STATIC FILES LINK (Serves your flat files explicitly)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Start network port listener channel
app.listen(PORT, () => {
    console.log(`🚀 JoyTech Solutions Engine active on network port: ${PORT}`);
});
