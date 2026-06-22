const express = require('express');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Secure form submission endpoint maps directly to frontend layout schema
app.post('/api/quote', async (req, res) => {
  const { name, email, service, message } = req.body;

  if (!name || !email || !service || !message) {
    return res.status(400).json({ error: 'All form fields are required.' });
  }

  try {
    const queryText = 'INSERT INTO quote_requests (name, email, service, message) VALUES ($1, $2, $3, $4) RETURNING *';
    const values = [name, email, service, message];
    await pool.query(queryText, values);
    
    return res.status(200).json({ success: true, message: 'Saved successfully!' });
  } catch (err) {
    console.error('Database Error:', err);
    return res.status(500).json({ error: 'Failed to write record to remote Neon cluster database.' });
  }
});

// Secure admin inbox data pipeline
app.get('/api/messages', async (req, res) => {
  const passwordInput = req.headers['x-admin-password'];
  
  if (!passwordInput || passwordInput !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized. Wrong admin password configuration.' });
  }
  
  try {
    const result = await pool.query('SELECT * FROM quote_requests ORDER BY submitted_at DESC');
    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('Database Retrieval Error:', err);
    return res.status(500).json({ error: 'Could not fetch inbox entries from cluster.' });
  }
});

app.listen(PORT, () => {
  console.log(`JoyTech Solutions active on port ${PORT}`);
});
