const express = require('express');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// JWT Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Authentication required' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Session expired' });
    req.user = user;
    next();
  });
};

// --- AUTH API ---
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    const result = await db.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, role',
      [name, email, hashed]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ message: 'Email account already registered' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(400).json({ message: 'User account not found' });
    
    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(400).json({ message: 'Incorrect password credentials' });

    const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- SERVICES API ---
app.get('/api/services', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM services ORDER BY category');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- REQUESTS API ---
app.post('/api/requests', authenticateToken, async (req, res) => {
  const { serviceId, details } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO requests (customer_id, service_id, details) VALUES ($1, $2, $3) RETURNING *',
      [req.user.id, serviceId, details]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/requests/dashboard', authenticateToken, async (req, res) => {
  try {
    let result;
    if (req.user.role === 'admin') {
      result = await db.query(
        `SELECT r.*, s.title, s.price, u.name as customer_name, u.email as customer_email 
         FROM requests r JOIN services s ON r.service_id = s.id JOIN users u ON r.customer_id = u.id ORDER BY r.created_at DESC`
      );
    } else {
      result = await db.query(
        `SELECT r.*, s.title, s.price FROM requests r JOIN services s ON r.service_id = s.id 
         WHERE r.customer_id = $1 ORDER BY r.created_at DESC`, [req.user.id]
      );
    }
    res.json({ role: req.user.role, requests: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/requests/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Unauthorized access' });
  const { status } = req.body;
  try {
    await db.query('UPDATE requests SET status = $1 WHERE id = $2', [status, req.params.id]);
    res.json({ message: 'Request updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Navigation Fallbacks
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Cyber Hub running on port ${PORT}`));
