const express = require('express');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Database Connection Pooling via Neon Console
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: true
  }
});

// Middleware configuration
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// API Endpoint to process and save form inquiries
app.post('/api/quote', async (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'All structural fields are required.' });
  }

  try {
    const queryText = 'INSERT INTO quote_requests (name, email, message) VALUES ($1, $2, $3) RETURNING *';
    const values = [name, email, message];
    const result = await pool.query(queryText, values);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Inquiry successfully logged into the core database.',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Database insertion breakdown:', err);
    return res.status(500).json({ error: 'Internal pipeline database error.' });
  }
});

// Start application listener
app.listen(PORT, () => {
  console.log(`JoyTech Solutions active on port ${PORT}`);
});
