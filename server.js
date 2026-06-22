const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware Configuration
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname))); // Serves files from flat root directory

// Database Connection to Neon PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Required for secure Neon handshakes
});

// --- ENHANCED AUTHENTICATION MIDDLEWARE ---
const checkAdminPassword = (req, res, next) => {
    const incomingPassword = req.headers['x-admin-password'];
    
    // Checks Render environment variable first; defaults to your exact secret password string
    const systemPassword = process.env.ADMIN_PASSWORD || 'JoyTechAdmin2026';

    if (incomingPassword === systemPassword) {
        return next(); // Credentials match, authorized to proceed!
    }

    return res.status(401).json({ error: "Login Failed. Password is not correct." });
};

// --- SYSTEM MATRIX STATS ENDPOINT ---
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
        console.error(err);
        res.status(500).json({ error: "Failed to gather operational telemetry stats." });
    }
});

// --- CUSTOMER MESSAGES / INBOX ENDPOINTS ---
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
        res.status(500).json({ error: "Failed to update logs tracking profile." });
    }
});

app.delete('/api/messages/:id', checkAdminPassword, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM messages WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to purge database entry record." });
    }
});

// --- SHOP TO-DO NOTEBOOK ENDPOINTS ---
app.get('/api/tasks', checkAdminPassword, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM tasks ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Failed to read operational check logs." });
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
        res.status(500).json({ error: "Failed to record task log tracking index." });
    }
});

app.put('/api/tasks/:id', checkAdminPassword, async (req, res) => {
    const { id } = req.params;
    const { is_completed } = req.body;
    try {
        await pool.query('UPDATE tasks SET is_completed = $1 WHERE id = $2', [is_completed, id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to switch checkbox verification tracking state." });
    }
});

app.delete('/api/tasks/:id', checkAdminPassword, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to clean task index logging entry." });
    }
});

// --- HOMEPAGE EDIT SERVICES ENDPOINTS ---
app.get('/api/services', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM services ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Failed to load public feature arrays." });
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
        res.status(500).json({ error: "Failed to register custom web card configurations." });
    }
});

app.delete('/api/services/:id', checkAdminPassword, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM services WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to discard custom service instance matrix." });
    }
});

// Catch-all route to serve the main user index page for any broken deep-links
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Boot listening port server channel
app.listen(PORT, () => {
    console.log(`System backend running on network port link channel: ${PORT}`);
});
