const express = require('express');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');
require('dotenv').config();

const app = express();

// Global Configuration Middlewares
app.use(cors());
app.use(express.json());

// Serve static assets natively from the flat root directory
app.use(express.static(__dirname));

/**
 * JWT Authentication Middleware
 * Validates incoming Authorization Bearer headers to protect user workflows and dashboard pipelines.
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Access Denied: Authentication token required.' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Access Denied: Session expired or invalid token.' });
    }
    req.user = user;
    next();
  });
};

// =========================================================================
// 1. AUTHENTICATION ENDPOINTS
// =========================================================================

/**
 * Handle User Registration
 * Encrypts user credentials securely using bcryptjs with 10 cryptographic salt rounds.
 */
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'All registration fields are mandatory.' });
  }

  try {
    const userCheck = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ message: 'This email account is already registered.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const result = await db.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, role',
      [name, email, hashedPassword]
    );
    
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Database exception occurred during profile registration.' });
  }
});

/**
 * Handle User Sign In
 * Validates credentials and generates a 24-hour cryptographic security token.
 */
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password inputs are required.' });
  }

  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Account credentials not found in our system.' });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect password sequence.' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    return res.json({
      token,
      user: { id: user.id, name: user.name, role: user.role }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Database exception encountered during authentication handling.' });
  }
});

// =========================================================================
// 2. SERVICES CATALOG ENDPOINTS
// =========================================================================

/**
 * Fetch All Available Solutions & Services
 * Pulls sorted workflow profiles directly out of the database to populate frontend data cards.
 */
app.get('/api/services', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM services ORDER BY category ASC, title ASC');
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve available system service parameters.' });
  }
});

// =========================================================================
// 3. SERVICE REQUEST PIPELINE ENDPOINTS
// =========================================================================

/**
 * Submit New Client Request Entry
 * Creates a new processing task entry bound to the logged-in client profile.
 */
app.post('/api/requests', authenticateToken, async (req, res) => {
  const { serviceId, details } = req.body;

  if (!serviceId || !details) {
    return res.status(400).json({ message: 'Service id and execution details are required.' });
  }

  try {
    const result = await db.query(
      'INSERT INTO requests (customer_id, service_id, details) VALUES ($1, $2, $3) RETURNING *',
      [req.user.id, serviceId, details]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to safely register your service assignment instructions.' });
  }
});

/**
 * Get Dashboard Request Metrics
 * Outputs system-wide analytics logs to verified Admins, or filtered personal order arrays to Customers.
 */
app.get('/api/requests/dashboard', authenticateToken, async (req, res) => {
  try {
    let result;
    if (req.user.role === 'admin') {
      result = await db.query(
        `SELECT r.id, r.details, r.status, r.created_at, s.title, s.price, u.name as customer_name, u.email as customer_email 
         FROM requests r 
         JOIN services s ON r.service_id = s.id 
         JOIN users u ON r.customer_id = u.id 
         ORDER BY r.created_at DESC`
      );
    } else {
      result = await db.query(
        `SELECT r.id, r.details, r.status, r.created_at, s.title, s.price 
         FROM requests r 
         JOIN services s ON r.service_id = s.id 
         WHERE r.customer_id = $1 
         ORDER BY r.created_at DESC`, 
        [req.user.id]
      );
    }
    return res.json({ role: req.user.role, requests: result.rows });
  } catch (err) {
    return res.status(500).json({ error: 'Error pulling active dashboard request metrics.' });
  }
});

/**
 * Update Existing Assignment Status State
 * Locked strictly to administrative team credentials.
 */
app.put('/api/requests/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access Denied: Administrative security privileges required.' });
  }

  const { status } = req.body;
  const validStatuses = ['pending', 'processing', 'completed', 'cancelled'];

  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid target status string provided.' });
  }

  try {
    const result = await db.query(
      'UPDATE requests SET status = $1 WHERE id = $2 RETURNING id',
      [status, req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Target processing log entry could not be located.' });
    }
    
    return res.json({ message: 'Request pipeline state adjusted successfully.' });
  } catch (err) {
    return res.status(500).json({ error: 'Error executing status adjustments on live records.' });
  }
});

// =========================================================================
// 4. MULTI-PAGE SECURE VIEW STATIC ROUTING
// =========================================================================

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, 'signup.html'));
});

app.get('/reset', (req, res) => {
  res.sendFile(path.join(__dirname, 'reset.html'));
});

app.get('/services', (req, res) => {
  res.sendFile(path.join(__dirname, 'services.html'));
});

app.get('/contact', (req, res) => {
  res.sendFile(path.join(__dirname, 'contact.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// Default fallback route mapping all raw incoming requests back to the Core Landing View
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// =========================================================================
// 5. SERVER RUNTIME INITIALIZATION
// =========================================================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`[JoyTech Solutions Production Instance Running On Port: ${PORT}]`));
