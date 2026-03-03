try { require('dotenv').config(); } catch (e) { /* dotenv optional */ }
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const { sendPasswordReset } = require(path.join(__dirname, 'lib', 'mail'));

const app = express();
const PORT = process.env.PORT || 3000;

// Database - use /tmp for Vercel serverless, local path for development
const isVercel = process.env.VERCEL || process.env.VERCEL_ENV;
const dbPath = isVercel 
  ? path.join('/tmp', 'library.db')
  : path.join(__dirname, 'data', 'library.db');

let db;
try {
  db = new Database(dbPath);
  console.log('Database connected:', dbPath);
} catch (e) {
  console.error('Database connection failed:', e.message);
  // Create a fallback or continue without database for static serving
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'library-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

// Page routes (before static so /forgot-password etc. are always handled)
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/signup', (req, res) => res.sendFile(path.join(__dirname, 'public', 'signup.html')));
app.get('/admin-signup', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin-signup.html')));
app.get('/admin-home', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin-home.html')));
app.get('/forgot-password', (req, res) => res.sendFile(path.join(__dirname, 'public', 'forgot-password.html')));
app.get('/simple-forgot-password', (req, res) => res.sendFile(path.join(__dirname, 'public', 'simple-forgot-password.html')));
app.get('/reset-password', (req, res) => res.sendFile(path.join(__dirname, 'public', 'reset-password.html')));
app.get('/reset-password-simple', (req, res) => res.sendFile(path.join(__dirname, 'public', 'reset-password-simple.html')));
app.get('/books', (req, res) => res.sendFile(path.join(__dirname, 'public', 'books.html')));
app.get('/reserve', (req, res) => res.sendFile(path.join(__dirname, 'public', 'reserve.html')));
app.get('/my-reservations', (req, res) => res.sendFile(path.join(__dirname, 'public', 'my-reservations.html')));
app.get('/ebooks', (req, res) => res.sendFile(path.join(__dirname, 'public', 'ebooks.html')));
app.get('/ebook/:id', (req, res) => res.sendFile(path.join(__dirname, 'public', 'ebook-viewer.html')));
app.get('/book/:id', (req, res) => res.sendFile(path.join(__dirname, 'public', 'book.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/ebooks', express.static(path.join(__dirname, 'ebooks')));

// Auth helper
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(401).json({ error: 'Please log in.' });
  }
  return res.redirect('/login?redirect=' + encodeURIComponent(req.originalUrl));
}

// ----- API: Auth -----
app.post('/api/signup', (req, res) => {
  const { email, password, name, securityQuestion, securityAnswer, isAdmin } = req.body || {};
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password, and name are required.' });
  }
  
  // For admin users, skip security questions
  if (!isAdmin) {
    if (!securityQuestion || !securityAnswer) {
      return res.status(400).json({ error: 'Security question and answer are required for password recovery.' });
    }
  }
  
  const hash = bcrypt.hashSync(password, 10);
  try {
    if (isAdmin) {
      // Create admin user without security questions
      db.prepare(`
        INSERT INTO users (email, password_hash, name, verified, is_admin, security_question, security_answer)
        VALUES (?, ?, ?, 1, 1, NULL, NULL)
      `).run(email, hash, name);
    } else {
      // Create regular user with security questions
      db.prepare(`
        INSERT INTO users (email, password_hash, name, verified, security_question, security_answer)
        VALUES (?, ?, ?, 1, ?, ?)
      `).run(email, hash, name, securityQuestion, securityAnswer.toLowerCase());
    }
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Email already registered.' });
    return res.status(500).json({ error: 'Registration failed.' });
  }
  return res.json({ success: true, email, isAdmin });
});

// Admin signup - no approval required
app.post('/api/admin-signup', (req, res) => {
  const { email, password, name } = req.body || {};
  
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password, and name are required.' });
  }
  
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  
  const hash = bcrypt.hashSync(password, 10);
  try {
    db.prepare(`
      INSERT INTO users (email, password_hash, name, verified, is_admin, security_question, security_answer)
      VALUES (?, ?, ?, 1, 1, NULL, NULL)
    `).run(email, hash, name);
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Email already registered.' });
    return res.status(500).json({ error: 'Admin registration failed.' });
  }
  return res.json({ success: true, email, isAdmin: true });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  const user = db.prepare('SELECT id, name, email, password_hash, is_admin FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  req.session.userId = user.id;
  req.session.userName = user.name;
  req.session.userEmail = user.email;
  return res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, isAdmin: !!user.is_admin } });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  return res.json({ success: true });
});

app.post('/api/forgot-password', (req, res) => {
  const email = (req.body && req.body.email) ? req.body.email.trim() : '';
  if (!email) return res.status(400).json({ error: 'Email is required.' });
  const user = db.prepare('SELECT id, email FROM users WHERE email = ?').get(email);
  if (!user) {
    return res.json({ success: true, message: 'If an account exists with this email, you will receive a reset link.' });
  }
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  db.prepare('UPDATE users SET password_reset_token = ?, password_reset_expires = ? WHERE id = ?')
    .run(token, expires, user.id);
  const baseUrl = process.env.BASE_URL || (`http://localhost:${PORT}`);
  const resetLink = `${baseUrl}/reset-password?token=${token}`;
  
  sendPasswordReset(email, resetLink, (err) => {
    if (err) {
      console.error('Email send failed:', err.message);
      // Check if email is configured
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        return res.status(500).json({ 
          error: 'Email service not configured. Please contact the administrator to set up email for password resets.',
          devInfo: `Reset link (for development): ${resetLink}`
        });
      }
      return res.status(500).json({ error: 'Could not send reset email. Try again later or contact support.' });
    }
    res.json({ success: true, message: 'If an account exists with this email, you will receive a reset link.' });
  });
});

// Simple forgot password - with security question verification
app.post('/api/simple-forgot-password', (req, res) => {
  const { email, securityQuestion, securityAnswer } = req.body || {};
  if (!email || !securityQuestion || !securityAnswer) {
    return res.status(400).json({ error: 'Email, security question, and answer are required.' });
  }
  
  const user = db.prepare('SELECT id, email, security_question, security_answer FROM users WHERE email = ?').get(email.trim());
  if (!user) {
    return res.status(404).json({ error: 'No account found with this email address.' });
  }
  
  // Verify security question and answer
  if (!user.security_question || !user.security_answer) {
    return res.status(400).json({ error: 'This account has not set up security questions. Please contact administrator.' });
  }
  
  if (user.security_question !== securityQuestion || user.security_answer.toLowerCase() !== securityAnswer.toLowerCase()) {
    return res.status(400).json({ error: 'Incorrect security question or answer.' });
  }
  
  // Generate reset token
  const token = crypto.randomBytes(16).toString('hex');
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  
  db.prepare('UPDATE users SET password_reset_token = ?, password_reset_expires = ? WHERE id = ?')
    .run(token, expires, user.id);
  
  const baseUrl = process.env.BASE_URL || (`http://localhost:${PORT}`);
  const resetLink = `${baseUrl}/reset-password-simple?token=${token}&email=${encodeURIComponent(email)}`;
  
  return res.json({ 
    success: true, 
    resetLink: resetLink,
    token: token,
    email: email,
    expires: expires
  });
});

// Simple reset password
app.post('/api/simple-reset-password', (req, res) => {
  const { token, email, newPassword } = req.body || {};
  if (!token || !email || !newPassword) {
    return res.status(400).json({ error: 'Token, email, and new password are required.' });
  }
  if (String(newPassword).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  
  const user = db.prepare(`
    SELECT id, password_reset_expires 
    FROM users 
    WHERE password_reset_token = ? AND email = ?
  `).get(token, email);
  
  if (!user) {
    return res.status(400).json({ error: 'Invalid reset token or email.' });
  }
  
  const now = new Date().toISOString();
  if (user.password_reset_expires && user.password_reset_expires < now) {
    db.prepare('UPDATE users SET password_reset_token = NULL, password_reset_expires = NULL WHERE id = ?').run(user.id);
    return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' });
  }
  
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare(`
    UPDATE users 
    SET password_hash = ?, password_reset_token = NULL, password_reset_expires = NULL 
    WHERE id = ?
  `).run(hash, user.id);
  
  return res.json({ success: true, message: 'Password updated successfully! You can now log in.' });
});

app.post('/api/reset-password', (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password are required.' });
  if (String(newPassword).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  const user = db.prepare('SELECT id, password_reset_expires FROM users WHERE password_reset_token = ?').get(token);
  if (!user) return res.status(400).json({ error: 'Invalid or expired reset link. Request a new one.' });
  const now = new Date().toISOString();
  if (user.password_reset_expires && user.password_reset_expires < now) {
    db.prepare('UPDATE users SET password_reset_token = NULL, password_reset_expires = NULL WHERE id = ?').run(user.id);
    return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' });
  }
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ?, password_reset_token = NULL, password_reset_expires = NULL WHERE id = ?')
    .run(hash, user.id);
  res.json({ success: true, message: 'Password updated. You can log in now.' });
});

app.get('/api/me', (req, res) => {
  if (!req.session || !req.session.userId) return res.json({ user: null });
  const u = db.prepare('SELECT id, name, email, is_admin FROM users WHERE id = ?').get(req.session.userId);
  if (!u) return res.json({ user: null });
  return res.json({
    user: {
      id: u.id,
      name: u.name,
      email: u.email,
      isAdmin: !!u.is_admin
    }
  });
});

// Admin helper
function requireAdmin(req, res, next) {
  if (!req.session || !req.session.userId) {
    if (req.xhr || req.headers.accept?.includes('application/json')) return res.status(401).json({ error: 'Please log in.' });
    return res.redirect('/login?redirect=' + encodeURIComponent(req.originalUrl));
  }
  const u = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.session.userId);
  if (!u || !u.is_admin) {
    if (req.xhr || req.headers.accept?.includes('application/json')) return res.status(403).json({ error: 'Admin access required.' });
    return res.redirect('/');
  }
  next();
}

// ----- API: Books -----
app.get('/api/departments', (req, res) => {
  const rows = db.prepare('SELECT DISTINCT category AS department FROM books WHERE category IS NOT NULL AND category != "" ORDER BY category').all();
  return res.json(rows.map(r => r.department));
});

app.get('/api/books', (req, res) => {
  const q = (req.query.q || '').trim().replace(/\s+/g, ' ');
  const department = (req.query.department || '').trim();
  let books;
  const sub = `(SELECT COUNT(*) FROM reservations r WHERE r.book_id = b.id AND r.status = 'active')`;
  const avail = `(b.quantity - ${sub})`;
  if (q) {
    const like = `%${q}%`;
    books = db.prepare(`
      SELECT b.*, ${sub} AS reserved, ${avail} AS available
      FROM books b
      WHERE (b.title LIKE ? OR b.author LIKE ? OR b.isbn LIKE ? OR b.category LIKE ?)
      ${department ? ' AND b.category = ?' : ''}
      ORDER BY b.title
    `).all(...[like, like, like, like].concat(department ? [department] : []));
  } else {
    if (department) {
      books = db.prepare(`
        SELECT b.*, ${sub} AS reserved, ${avail} AS available FROM books b WHERE b.category = ? ORDER BY b.title
      `).all(department);
    } else {
      books = db.prepare(`
        SELECT b.*, ${sub} AS reserved, ${avail} AS available FROM books b ORDER BY b.title
      `).all();
    }
  }
  return res.json(books);
});

app.get('/api/my-reservation/:bookId', requireAuth, (req, res) => {
  const bookId = parseInt(req.params.bookId, 10);
  if (!bookId) return res.status(400).json({ error: 'Book ID required.' });
  const row = db.prepare(`
    SELECT r.*, b.title, b.author
    FROM reservations r
    JOIN books b ON b.id = r.book_id
    WHERE r.user_id = ? AND r.book_id = ? AND r.status = 'active'
  `).get(req.session.userId, bookId);
  if (!row) return res.json({ reservation: null });
  return res.json({ reservation: row });
});

app.get('/api/books/:id', (req, res) => {
  const book = db.prepare(`
    SELECT b.*, 
      (SELECT COUNT(*) FROM reservations r WHERE r.book_id = b.id AND r.status = 'active') AS reserved,
      (b.quantity - (SELECT COUNT(*) FROM reservations r WHERE r.book_id = b.id AND r.status = 'active')) AS available
    FROM books b WHERE b.id = ?
  `).get(req.params.id);
  if (!book) return res.status(404).json({ error: 'Book not found.' });
  return res.json(book);
});

// ----- API: Reservations -----
app.get('/api/reservations', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT r.*, b.title, b.author, b.ebook_path
    FROM reservations r
    JOIN books b ON b.id = r.book_id
    WHERE r.user_id = ? AND r.status = 'active'
    ORDER BY r.reserved_at DESC
  `).all(req.session.userId);
  return res.json(rows);
});

app.post('/api/reserve', requireAuth, (req, res) => {
  const bookId = parseInt(req.body?.bookId || req.params?.bookId, 10);
  if (!bookId) return res.status(400).json({ error: 'Book ID required.' });

  const book = db.prepare(`
    SELECT id, quantity,
      (SELECT COUNT(*) FROM reservations r WHERE r.book_id = books.id AND r.status = 'active') AS reserved
    FROM books WHERE id = ?
  `).get(bookId);

  if (!book) return res.status(404).json({ error: 'Book not found.' });
  const available = book.quantity - (book.reserved || 0);
  if (available < 1) return res.status(400).json({ error: 'No copies available.' });

  const existing = db.prepare('SELECT id FROM reservations WHERE user_id = ? AND book_id = ? AND status = ?')
    .get(req.session.userId, bookId, 'active');
  if (existing) return res.status(400).json({ error: 'You already have this book reserved.' });

  const rawDays = parseInt(req.body?.days || req.query?.days || '14', 10);
  const days = Number.isFinite(rawDays) && rawDays > 0 && rawDays <= 60 ? rawDays : 14;
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + days);
  db.prepare(`
    INSERT INTO reservations (user_id, book_id, status, due_date) VALUES (?, ?, 'active', ?)
  `).run(req.session.userId, bookId, dueDate.toISOString());

  return res.json({ success: true, message: 'Book reserved successfully.', dueDate: dueDate.toISOString() });
});

app.post('/api/reservations/:id/return', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const r = db.prepare('UPDATE reservations SET status = ?, returned_at = ? WHERE id = ? AND user_id = ?')
    .run('returned', new Date().toISOString(), id, req.session.userId);
  if (r.changes === 0) return res.status(404).json({ error: 'Reservation not found.' });
  return res.json({ success: true });
});

// Due-date reminders
app.get('/api/due-soon', requireAuth, (req, res) => {
  const inDays = parseInt(req.query.days, 10) || 3;
  const future = new Date();
  future.setDate(future.getDate() + inDays);
  const rows = db.prepare(`
    SELECT r.id, r.due_date, b.title
    FROM reservations r
    JOIN books b ON b.id = r.book_id
    WHERE r.user_id = ? AND r.status = 'active' AND r.due_date IS NOT NULL AND r.due_date <= ?
    ORDER BY r.due_date ASC
  `).all(req.session.userId, future.toISOString());
  return res.json(rows);
});

// ----- API: Admin -----
app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const users = db.prepare('SELECT COUNT(*) AS n FROM users').get();
  const books = db.prepare('SELECT COUNT(*) AS n FROM books').get();
  const activeReservations = db.prepare("SELECT COUNT(*) AS n FROM reservations WHERE status = 'active'").get();
  return res.json({ users: users.n, books: books.n, activeReservations: activeReservations.n });
});

app.get('/api/admin/books', requireAdmin, (req, res) => {
  const books = db.prepare(`
    SELECT b.*, 
      (SELECT COUNT(*) FROM reservations r WHERE r.book_id = b.id AND r.status = 'active') AS reserved,
      (b.quantity - (SELECT COUNT(*) FROM reservations r WHERE r.book_id = b.id AND r.status = 'active')) AS available
    FROM books b ORDER BY b.title
  `).all();
  return res.json(books);
});

app.post('/api/admin/books', requireAdmin, (req, res) => {
  const { title, author, isbn, description, category, ebook_path, quantity } = req.body || {};
  if (!title || !author) return res.status(400).json({ error: 'Title and author required.' });
  const r = db.prepare(`
    INSERT INTO books (title, author, isbn, description, category, ebook_path, quantity)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    title || '',
    author || '',
    isbn || null,
    description || null,
    category || null,
    ebook_path || null,
    parseInt(quantity, 10) || 1
  );
  return res.json({ success: true, id: r.lastInsertRowid });
});

app.put('/api/admin/books/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { title, author, isbn, description, category, ebook_path, quantity } = req.body || {};
  const r = db.prepare(`
    UPDATE books SET title = ?, author = ?, isbn = ?, description = ?, category = ?, ebook_path = ?, quantity = ?
    WHERE id = ?
  `).run(
    title || '',
    author || '',
    isbn || null,
    description || null,
    category || null,
    ebook_path || null,
    parseInt(quantity, 10) || 1,
    id
  );
  if (r.changes === 0) return res.status(404).json({ error: 'Book not found.' });
  return res.json({ success: true });
});

app.delete('/api/admin/books/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  db.prepare('DELETE FROM reservations WHERE book_id = ?').run(id);
  const r = db.prepare('DELETE FROM books WHERE id = ?').run(id);
  if (r.changes === 0) return res.status(404).json({ error: 'Book not found.' });
  return res.json({ success: true });
});

app.get('/api/admin/users', requireAdmin, (req, res) => {
  const users = db.prepare('SELECT id, email, name, is_admin, created_at FROM users ORDER BY created_at DESC').all();
  return res.json(users);
});

app.get('/api/admin/reservations', requireAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT r.*, b.title, b.author, u.name AS user_name, u.email AS user_email
    FROM reservations r
    JOIN books b ON b.id = r.book_id
    JOIN users u ON u.id = r.user_id
    WHERE r.status = 'active'
    ORDER BY r.due_date ASC
  `).all();
  return res.json(rows);
});

app.post('/api/admin/reservations/:id/unreserve', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Reservation ID required.' });
  const result = db.prepare(`
    UPDATE reservations
    SET status = 'returned', returned_at = ?
    WHERE id = ? AND status = 'active'
  `).run(new Date().toISOString(), id);
  if (result.changes === 0) return res.status(404).json({ error: 'Reservation not found or already closed.' });
  return res.json({ success: true });
});

app.patch('/api/admin/reservations/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { due_date } = req.body || {};
  if (!id) return res.status(400).json({ error: 'Reservation ID required.' });
  if (!due_date) return res.status(400).json({ error: 'due_date required (ISO string).' });
  const result = db.prepare('UPDATE reservations SET due_date = ? WHERE id = ? AND status = ?').run(due_date, id, 'active');
  if (result.changes === 0) return res.status(404).json({ error: 'Reservation not found or already closed.' });
  return res.json({ success: true });
});

const HOST = process.env.HOST || '0.0.0.0';

// Only start server if not running on Vercel (local development)
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, HOST, () => {
    console.log('Library server running at http://localhost:' + PORT);
    if (HOST === '0.0.0.0') console.log('To open from other devices, use http://<this-pc-ip>:' + PORT + ' (e.g. http://192.168.1.5:' + PORT + ')');
  });
}

// Export for Vercel serverless functions
module.exports = app;
