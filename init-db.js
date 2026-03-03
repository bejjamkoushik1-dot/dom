const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '..', 'data', 'library.db');
const db = new Database(dbPath);

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    is_admin INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    isbn TEXT,
    description TEXT,
    category TEXT,
    cover_url TEXT,
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

  CREATE INDEX IF NOT EXISTS idx_reservations_user ON reservations(user_id);
  CREATE INDEX IF NOT EXISTS idx_reservations_book ON reservations(book_id);
`);

// Add is_admin column if missing (migration)
try {
  db.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0');
} catch (e) { /* column exists */ }

// Add category column to books if missing (migration)
try {
  db.exec('ALTER TABLE books ADD COLUMN category TEXT');
} catch (e) { /* column exists */ }

// OTP verification columns (migration)
try {
  db.exec('ALTER TABLE users ADD COLUMN verified INTEGER DEFAULT 0');
} catch (e) { /* exists */ }
try {
  db.exec('ALTER TABLE users ADD COLUMN otp_code TEXT');
} catch (e) { /* exists */ }
try {
  db.exec('ALTER TABLE users ADD COLUMN otp_expires_at DATETIME');
} catch (e) { /* exists */ }
try {
  db.exec('ALTER TABLE users ADD COLUMN password_reset_token TEXT');
} catch (e) { /* exists */ }
try {
  db.exec('ALTER TABLE users ADD COLUMN password_reset_expires DATETIME');
} catch (e) { /* exists */ }

// Seed demo admin user
const demoHash = bcrypt.hashSync('demo123', 10);
db.prepare(`
  INSERT OR IGNORE INTO users (email, password_hash, name, is_admin, verified) VALUES (?, ?, ?, 1, 1)
`).run('demo@library.com', demoHash, 'Demo User');
db.prepare('UPDATE users SET is_admin = 1, verified = 1 WHERE email = ?').run('demo@library.com');

// Seed books for R.V.R & J.C College of Engineering Library
const books = [
  {
    title: 'B.Tech CSE I Year – Programming in C',
    author: 'Dept. of CSE, R.V.R & J.C',
    isbn: 'RVRJC-CSE-101',
    description: 'Prescribed syllabus textbook for B.Tech CSE I Year Programming in C.',
    category: 'Syllabus – CSE',
    ebook_path: null,
    quantity: 15
  },
  {
    title: 'B.Tech CSE II Year – Data Structures',
    author: 'Dept. of CSE, R.V.R & J.C',
    isbn: 'RVRJC-CSE-201',
    description: 'Syllabus textbook covering linear and nonlinear data structures.',
    category: 'Syllabus – CSE',
    ebook_path: null,
    quantity: 12
  },
  {
    title: 'B.Tech ECE II Year – Signals and Systems',
    author: 'Dept. of ECE, R.V.R & J.C',
    isbn: 'RVRJC-ECE-205',
    description: 'Core textbook for Signals and Systems for ECE students.',
    category: 'Syllabus – ECE',
    ebook_path: null,
    quantity: 10
  },
  {
    title: 'B.Tech EEE III Year – Power Systems',
    author: 'Dept. of EEE, R.V.R & J.C',
    isbn: 'RVRJC-EEE-301',
    description: 'Syllabus textbook on generation, transmission and distribution of electric power.',
    category: 'Syllabus – EEE',
    ebook_path: null,
    quantity: 8
  },
  {
    title: 'Engineering Mathematics – I',
    author: 'Dept. of Mathematics, R.V.R & J.C',
    isbn: 'RVRJC-MATH-101',
    description: 'Common syllabus textbook for first year B.Tech students.',
    category: 'Common – Mathematics',
    ebook_path: null,
    quantity: 20
  },
  {
    title: 'Engineering Mathematics – II',
    author: 'Dept. of Mathematics, R.V.R & J.C',
    isbn: 'RVRJC-MATH-102',
    description: 'Continuation of Engineering Mathematics – I for B.Tech students.',
    category: 'Common – Mathematics',
    ebook_path: null,
    quantity: 18
  },
  {
    title: 'Discrete Mathematics for Computer Science',
    author: 'Kenneth H. Rosen',
    isbn: '9780073383095',
    description: 'Reference text for discrete structures, logic, combinatorics and graphs.',
    category: 'Reference – CSE',
    ebook_path: null,
    quantity: 6
  },
  {
    title: 'Operating System Concepts',
    author: 'Silberschatz, Galvin, Gagne',
    isbn: '9781119456339',
    description: 'Standard reference book for operating systems courses.',
    category: 'Reference – CSE',
    ebook_path: null,
    quantity: 6
  },
  {
    title: 'Computer Networks',
    author: 'Andrew S. Tanenbaum',
    isbn: '9780132126953',
    description: 'Reference book for computer networks and communication.',
    category: 'Reference – CSE',
    ebook_path: null,
    quantity: 5
  },
  {
    title: 'Digital Logic and Computer Design',
    author: 'M. Morris Mano',
    isbn: '9788120308094',
    description: 'Core reference for digital logic design.',
    category: 'Reference – ECE/EEE',
    ebook_path: null,
    quantity: 7
  },
  {
    title: 'Clean Code: A Handbook of Agile Software Craftsmanship',
    author: 'Robert C. Martin',
    isbn: '9780132350884',
    description: 'Coding practices and patterns for writing clean, maintainable code.',
    category: 'Coding – Best Practices',
    ebook_path: null,
    quantity: 4
  },
  {
    title: 'Introduction to Algorithms',
    author: 'Cormen, Leiserson, Rivest, Stein',
    isbn: '9780262033848',
    description: 'Comprehensive reference for algorithms and complexity analysis.',
    category: 'Coding – Algorithms',
    ebook_path: null,
    quantity: 5
  },
  {
    title: 'Python Programming for Engineers',
    author: 'Dept. of CSE, R.V.R & J.C',
    isbn: 'RVRJC-CSE-PY',
    description: 'Laboratory manual and reference for Python programming labs.',
    category: 'Coding – Python',
    ebook_path: null,
    quantity: 10
  },
  {
    title: 'Web Technologies – HTML, CSS & JavaScript',
    author: 'Dept. of IT, R.V.R & J.C',
    isbn: 'RVRJC-IT-WEB',
    description: 'Textbook covering fundamentals of web design and development.',
    category: 'Coding – Web',
    ebook_path: null,
    quantity: 9
  },
  {
    title: 'Database Management Systems',
    author: 'Raghu Ramakrishnan',
    isbn: '9780072465631',
    description: 'Reference book for relational databases and SQL.',
    category: 'Reference – DBMS',
    ebook_path: null,
    quantity: 6
  },
  {
    title: 'Compiler Design',
    author: 'Alfred V. Aho',
    isbn: '9780201100884',
    description: 'Reference text for compiler construction and language processors.',
    category: 'Reference – CSE',
    ebook_path: null,
    quantity: 4
  },
  {
    title: 'Object Oriented Programming with C++',
    author: 'E. Balagurusamy',
    isbn: '9780070616158',
    description: 'Textbook for OOP using C++ for B.Tech students.',
    category: 'Coding – C++',
    ebook_path: null,
    quantity: 8
  },
  {
    title: 'Java Programming – A Practical Approach',
    author: 'Dept. of CSE, R.V.R & J.C',
    isbn: 'RVRJC-CSE-JAVA',
    description: 'Lab manual and reference for Java programming.',
    category: 'Coding – Java',
    ebook_path: null,
    quantity: 10
  },
  {
    title: 'Soft Skills and Professional Ethics',
    author: 'Dept. of H&S, R.V.R & J.C',
    isbn: 'RVRJC-HS-PE',
    description: 'Common textbook on soft skills, ethics and professional practice.',
    category: 'Common – Humanities',
    ebook_path: null,
    quantity: 12
  },
  {
    title: 'Environmental Studies for Engineering',
    author: 'Dept. of H&S, R.V.R & J.C',
    isbn: 'RVRJC-HS-ENV',
    description: 'Mandatory common course on environmental science for engineers.',
    category: 'Common – Humanities',
    ebook_path: null,
    quantity: 14
  },
  { title: 'The C Programming Language', author: 'Brian W. Kernighan, Dennis M. Ritchie', isbn: '9780131103627', description: 'Classic C programming reference.', category: 'CSE', ebook_path: null, quantity: 10 },
  { title: 'Head First Java', author: 'Kathy Sierra, Bert Bates', isbn: '9780596009205', description: 'Java learning with visuals and exercises.', category: 'CSE', ebook_path: null, quantity: 8 },
  { title: 'JavaScript: The Good Parts', author: 'Douglas Crockford', isbn: '9780596517748', description: 'Essential JavaScript patterns and best practices.', category: 'CSE', ebook_path: null, quantity: 6 },
  { title: 'Design Patterns: Elements of Reusable Object-Oriented Software', author: 'Gang of Four', isbn: '9780201633610', description: 'Classic software design patterns.', category: 'CSE', ebook_path: null, quantity: 5 },
  { title: 'Structure and Interpretation of Computer Programs', author: 'Harold Abelson, Gerald Jay Sussman', isbn: '9780262510875', description: 'Foundational CS textbook using Scheme.', category: 'CSE', ebook_path: null, quantity: 4 },
  { title: 'Artificial Intelligence: A Modern Approach', author: 'Stuart Russell, Peter Norvig', isbn: '9780136042594', description: 'Comprehensive AI textbook.', category: 'CSE', ebook_path: null, quantity: 6 },
  { title: 'Machine Learning Yearning', author: 'Andrew Ng', isbn: '9781732261152', description: 'Technical strategy for ML projects.', category: 'CSE', ebook_path: null, quantity: 5 },
  { title: 'The Pragmatic Programmer', author: 'David Thomas, Andrew Hunt', isbn: '9780135957059', description: 'Practical software development tips.', category: 'CSE', ebook_path: null, quantity: 7 },
  { title: 'Code Complete', author: 'Steve McConnell', isbn: '9780735619678', description: 'Practical handbook of software construction.', category: 'CSE', ebook_path: null, quantity: 5 },
  { title: 'Refactoring: Improving the Design of Existing Code', author: 'Martin Fowler', isbn: '9780134757599', description: 'Techniques for refactoring code.', category: 'CSE', ebook_path: null, quantity: 4 },
  { title: 'Effective Java', author: 'Joshua Bloch', isbn: '9780134685991', description: 'Best practices for Java platform.', category: 'CSE', ebook_path: null, quantity: 6 },
  { title: 'Python Crash Course', author: 'Eric Matthes', isbn: '9781593275990', description: 'Hands-on Python programming.', category: 'CSE', ebook_path: null, quantity: 8 },
  { title: 'Fluent Python', author: 'Luciano Ramalho', isbn: '9781491946008', description: 'Clear, concise Python programming.', category: 'CSE', ebook_path: null, quantity: 5 },
  { title: 'Learning React', author: 'Alex Banks, Eve Porcello', isbn: '9781491954621', description: 'Modern React development.', category: 'CSE', ebook_path: null, quantity: 5 },
  { title: 'Fundamentals of Electric Circuits', author: 'Charles K. Alexander, Matthew N. O. Sadiku', isbn: '9780073380575', description: 'Core textbook for electrical circuits.', category: 'ECE', ebook_path: null, quantity: 12 },
  { title: 'Microelectronic Circuits', author: 'Adel S. Sedra, Kenneth C. Smith', isbn: '9780199339136', description: 'Analog and digital microelectronics.', category: 'ECE', ebook_path: null, quantity: 6 },
  { title: 'Communication Systems', author: 'Simon Haykin', isbn: '9780471178699', description: 'Analog and digital communications.', category: 'ECE', ebook_path: null, quantity: 5 },
  { title: 'Control Systems Engineering', author: 'Norman S. Nise', isbn: '9781118174619', description: 'Feedback control systems.', category: 'ECE', ebook_path: null, quantity: 6 },
  { title: 'Digital Signal Processing', author: 'John G. Proakis, Dimitris G. Manolakis', isbn: '9780131873742', description: 'Principles of DSP.', category: 'ECE', ebook_path: null, quantity: 5 },
  { title: 'Electrical Power Systems', author: 'C. L. Wadhwa', isbn: '9788120327832', description: 'Power system analysis and design.', category: 'EEE', ebook_path: null, quantity: 8 },
  { title: 'Power System Analysis', author: 'John J. Grainger, William D. Stevenson', isbn: '9780070612938', description: 'Analysis of power systems.', category: 'EEE', ebook_path: null, quantity: 6 },
  { title: 'Electric Machines', author: 'Charles I. Hubert', isbn: '9780130612106', description: 'Transformers and rotating machines.', category: 'EEE', ebook_path: null, quantity: 7 },
  { title: 'Engineering Mechanics: Statics and Dynamics', author: 'R. C. Hibbeler', isbn: '9780133915426', description: 'Statics and dynamics for engineers.', category: 'Mechanical', ebook_path: null, quantity: 10 },
  { title: 'Thermodynamics: An Engineering Approach', author: 'Yunus A. Cengel, Michael A. Boles', isbn: '9780073398174', description: 'Applied thermodynamics.', category: 'Mechanical', ebook_path: null, quantity: 8 },
  { title: 'Fluid Mechanics', author: 'Frank M. White', isbn: '9780073398273', description: 'Fundamentals of fluid mechanics.', category: 'Mechanical', ebook_path: null, quantity: 6 },
  { title: 'Mechanics of Materials', author: 'Russell C. Hibbeler', isbn: '9780134319650', description: 'Stress, strain, and deformation.', category: 'Civil', ebook_path: null, quantity: 8 },
  { title: 'Structural Analysis', author: 'R. C. Hibbeler', isbn: '9780136020606', description: 'Analysis of structures.', category: 'Civil', ebook_path: null, quantity: 6 },
  { title: 'Concrete Technology', author: 'M. S. Shetty', isbn: '9788121900034', description: 'Concrete materials and technology.', category: 'Civil', ebook_path: null, quantity: 5 },
  { title: 'Higher Engineering Mathematics', author: 'B. S. Grewal', isbn: '9788174091953', description: 'Advanced mathematics for engineers.', category: 'Mathematics', ebook_path: null, quantity: 15 },
  { title: 'Advanced Engineering Mathematics', author: 'Erwin Kreyszig', isbn: '9780470458365', description: 'Comprehensive engineering math.', category: 'Mathematics', ebook_path: null, quantity: 8 },
  { title: 'Probability and Statistics for Engineers', author: 'Richard L. Scheaffer', isbn: '9780534401113', description: 'Applied probability and statistics.', category: 'Mathematics', ebook_path: null, quantity: 7 },
  { title: 'Linear Algebra and Its Applications', author: 'Gilbert Strang', isbn: '9780030105678', description: 'Linear algebra for applied math.', category: 'Mathematics', ebook_path: null, quantity: 6 },
  { title: 'Communication Skills', author: 'Sanjay Kumar, Pushp Lata', isbn: '9780198060349', description: 'Professional communication.', category: 'Humanities', ebook_path: null, quantity: 12 },
  { title: 'Technical Communication', author: 'Mike Markel', isbn: '9781319058612', description: 'Technical writing and presentation.', category: 'Humanities', ebook_path: null, quantity: 6 },
  { title: 'Engineering Drawing', author: 'N. D. Bhatt', isbn: '9789385031151', description: 'Engineering graphics and drawing.', category: 'General', ebook_path: null, quantity: 20 },
  { title: 'Basic Electrical Engineering', author: 'V. K. Mehta, Rohit Mehta', isbn: '9788121924375', description: 'Introductory electrical engineering.', category: 'EEE', ebook_path: null, quantity: 15 },
  { title: 'Data Communications and Networking', author: 'Behrouz A. Forouzan', isbn: '9780073376226', description: 'Networking fundamentals.', category: 'CSE', ebook_path: null, quantity: 8 },
  { title: 'Software Engineering: A Practitioner\'s Approach', author: 'Roger S. Pressman', isbn: '9780073375977', description: 'Software development lifecycle.', category: 'CSE', ebook_path: null, quantity: 6 }
];

const insertBook = db.prepare(`
  INSERT INTO books (title, author, isbn, description, category, ebook_path, quantity)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const exists = db.prepare('SELECT 1 FROM books WHERE title = ? AND author = ? LIMIT 1');
let added = 0;
for (const b of books) {
  if (!exists.get(b.title, b.author)) {
    insertBook.run(
      b.title,
      b.author,
      b.isbn,
      b.description,
      b.category || null,
      b.ebook_path || null,
      b.quantity
    );
    added++;
  }
}
if (added > 0) console.log('Added', added, 'books to database.');
console.log('Total books in library:', db.prepare('SELECT COUNT(*) AS n FROM books').get().n);

console.log('Database initialized at', dbPath);
db.close();
