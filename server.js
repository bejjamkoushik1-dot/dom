try { require('dotenv').config(); } catch (e) { /* dotenv optional */ }
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;

// Database - handle Vercel serverless
let db = null;
try {
  const isVercel = process.env.VERCEL;
  const dbPath = isVercel ? '/tmp/library.db' : path.join(__dirname, 'data', 'library.db');
  db = new Database(dbPath);
  console.log('DB connected');
} catch (e) {
  console.log('DB error:', e.message);
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'library-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/ebooks', express.static(path.join(__dirname, 'ebooks')));

// Routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/signup', (req, res) => res.sendFile(path.join(__dirname, 'public', 'signup.html')));
app.get('/admin-signup', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin-signup.html')));
app.get('/admin-home', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin-home.html')));
app.get('/books', (req, res) => res.sendFile(path.join(__dirname, 'public', 'books.html')));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'OK', db: !!db }));

// Export for Vercel
module.exports = app;

// Local server
if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`Server on port ${PORT}`));
}
