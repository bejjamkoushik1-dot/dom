const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

// Initialize database
const dbPath = path.join(__dirname, 'data', 'library.db');
const db = new Database(dbPath);

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    is_admin INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    verified INTEGER DEFAULT 0,
    otp_code TEXT,
    otp_expires_at DATETIME,
    password_reset_token TEXT,
    password_reset_expires DATETIME
  );

  CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    isbn TEXT,
    description TEXT,
    category TEXT,
    ebook_path TEXT,
    quantity INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    book_id INTEGER NOT NULL,
    status TEXT DEFAULT 'active',
    reserved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    due_date DATETIME,
    returned_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (book_id) REFERENCES books(id)
  );
`);

// Create default admin user (no security questions required)
const adminEmail = 'admin@rvrjc.edu';
const adminPassword = 'admin123';
const adminHash = bcrypt.hashSync(adminPassword, 10);

try {
  db.prepare(`
    INSERT OR IGNORE INTO users (email, password_hash, name, is_admin, verified, security_question, security_answer)
    VALUES (?, ?, ?, 1, 1, NULL, NULL)
  `).run(adminEmail, adminHash, 'Library Administrator');
  
  console.log('✅ Default admin user created:');
  console.log(`   Email: ${adminEmail}`);
  console.log(`   Password: ${adminPassword}`);
  console.log('   Note: Admin accounts bypass security questions');
} catch (e) {
  console.log('Admin user may already exist');
}

// Create test user
const testEmail = 'test@example.com';
const testPassword = 'testpassword123';
const testHash = bcrypt.hashSync(testPassword, 10);

try {
  db.prepare(`
    INSERT OR IGNORE INTO users (email, password_hash, name, verified)
    VALUES (?, ?, ?, 1)
  `).run(testEmail, testHash, 'Test User');
  
  console.log('✅ Test user created:');
  console.log(`   Email: ${testEmail}`);
  console.log(`   Password: ${testPassword}`);
} catch (e) {
  console.log('Test user may already exist');
}

// Add some sample books
const sampleBooks = [
  { title: 'Introduction to Computer Science', author: 'John Smith', category: 'Computer Science', quantity: 3 },
  { title: 'Engineering Mathematics', author: 'Jane Doe', category: 'Mathematics', quantity: 2 },
  { title: 'Digital Electronics', author: 'Robert Johnson', category: 'Electronics', quantity: 1 },
  { title: 'Data Structures and Algorithms', author: 'Alice Brown', category: 'Computer Science', quantity: 2 },
  { title: 'Mechanical Engineering Basics', author: 'Michael Wilson', category: 'Mechanical', quantity: 1 }
];

sampleBooks.forEach(book => {
  try {
    db.prepare(`
      INSERT OR IGNORE INTO books (title, author, category, quantity)
      VALUES (?, ?, ?, ?)
    `).run(book.title, book.author, book.category, book.quantity);
  } catch (e) {
    // Book may already exist
  }
});

console.log('✅ Database initialized successfully!');
console.log('📚 Sample books added');

db.close();
