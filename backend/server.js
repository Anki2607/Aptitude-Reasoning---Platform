console.log('Server starting...');
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serve frontend static files
const publicPath = path.join(__dirname, '../frontend');
app.use(express.static(publicPath));

// Simple test route
app.get('/hello', (req, res) => {
  res.send('Hello from Express!');
});

// Route for root path
app.get('/', (req, res) => {
  console.log('Serving index.html for root');
  const filePath = path.join(__dirname, '../frontend/index.html');
  console.log('File path:', filePath);
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Error sending file:', err);
      res.status(500).send('Error loading page');
    }
  });
});

// DB CONNECTION
console.log('Connecting to SQLite...');
const db = new sqlite3.Database('../aptitude_platform.db', (err) => {
  console.log('DB callback called');
  if (err) {
    console.log('DB Connection Failed:', err);
  } else {
    console.log('SQLite Connected');
    // Create tables if they don't exist
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT UNIQUE,
      password TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS question (
      q_id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic TEXT,
      difficulty TEXT,
      question TEXT,
      optionA TEXT,
      optionB TEXT,
      optionC TEXT,
      optionD TEXT,
      correct_ans TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS quiz_attempt (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      score INTEGER,
      topic TEXT,
      difficulty TEXT,
      attempt_date TEXT
    )`);
  }
});


// ================= REGISTER =================
app.post('/register', (req, res) => {
  const { name, email, password } = req.body;

  // Check if email already exists
  db.get('SELECT * FROM users WHERE email=?', [email], (err, row) => {
    if (err) return res.send('Database Error');

    if (row) {
      return res.send('Email already registered');
    }

    // Insert new user
    db.run(
      'INSERT INTO users (name,email,password) VALUES (?,?,?)',
      [name, email, password],
      function(err) {
        if (err) {
          res.send('Error while registering');
        } else {
          res.send('Registered Successfully');
        }
      }
    );
  });
});


// ================= LOGIN =================
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  db.get(
    'SELECT * FROM users WHERE email=? AND password=?',
    [email, password],
    (err, row) => {
      if (err) return res.send({ success: false });

      if (row) {
        res.send({ success: true, user: row });
      } else {
        res.send({ success: false });
      }
    }
  );
});


// ================= ADD QUESTION =================
app.post('/add-question', (req, res) => {
  const { topic, difficulty, question, optionA, optionB, optionC, optionD, correct_ans } = req.body;

  db.run(
    'INSERT INTO question (topic,difficulty,question,optionA,optionB,optionC,optionD,correct_ans) VALUES (?,?,?,?,?,?,?,?)',
    [topic, difficulty, question, optionA, optionB, optionC, optionD, correct_ans],
    function(err) {
      if (err) res.send('Error');
      else res.send('Question Added');
    }
  );
});


// ================= GET QUESTIONS =================
app.get('/questions', (req, res) => {
  const { topic, difficulty } = req.query;

  db.all(
    'SELECT * FROM question WHERE topic=? AND difficulty=?',
    [topic, difficulty],
    (err, rows) => {
      if (err) res.send([]);
      else res.send(rows);
    }
  );
});


// ================= DELETE QUESTION =================
app.delete('/delete/:id', (req, res) => {
  db.run('DELETE FROM question WHERE q_id=?', [req.params.id], function(err) {
    if (err) res.send('Error');
    else res.send('Deleted Successfully');
  });
});


// ================= SAVE SCORE =================
app.post('/save-score', (req, res) => {
  const { user_id, score, topic, difficulty } = req.body;

  db.run(
    'INSERT INTO quiz_attempt (user_id,score,topic,difficulty,attempt_date) VALUES (?,?,?,?,datetime(\'now\'))',
    [user_id, score, topic, difficulty],
    function(err) {
      if (err) res.send('Error');
      else res.send('Score Saved');
    }
  );
});


/* ================= GET PROGRESS =================
app.get('/progress/:user_id', (req, res) => {
  db.all(
    'SELECT * FROM quiz_attempt WHERE user_id=?',
    [req.params.user_id],
    (err, rows) => {
      if (err) res.send([]);
      else res.send(rows);
    }
  );
});

// ================= GET LEADERBOARD (New Edit) =================
app.get('/leaderboard', (req, res) => {
    // Ye query har user ka best score nikaal kar top 5 dikhayegi
    const sql = `
        SELECT users.name, MAX(quiz_attempt.score) as score 
        FROM quiz_attempt 
        JOIN users ON quiz_attempt.user_id = users.id 
        GROUP BY users.id 
        ORDER BY score DESC 
        LIMIT 5`;

    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error(err);
            res.send([]);
        } else {
            res.send(rows);
        }
    });
});


console.log('About to start server...'); */

// ================= GET PROGRESS (Updated with Sorting) =================
app.get('/progress/:user_id', (req, res) => {
    const userId = req.params.user_id;
    // 'ORDER BY attempt_date DESC' taaki latest attempts dashboard par sabse upar dikhein
    const sql = 'SELECT * FROM quiz_attempt WHERE user_id = ? ORDER BY attempt_date DESC';
    
    db.all(sql, [userId], (err, rows) => {
        if (err) {
            console.error("Progress Fetch Error:", err);
            res.send([]);
        } else {
            res.send(rows);
        }
    });
});

// ================= GET LEADERBOARD (New Route for Rankings) =================
app.get('/leaderboard', (req, res) => {
    // Ye query har user ka highest score aur unka naam nikaal kar top 5 rank banati hai
    const sql = `
        SELECT users.name, MAX(quiz_attempt.score) as score 
        FROM quiz_attempt 
        JOIN users ON quiz_attempt.user_id = users.id 
        GROUP BY users.id 
        ORDER BY score DESC 
        LIMIT 5`;

    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error("Leaderboard Error:", err);
            res.send([]);
        } else {
            res.send(rows);
        }
    });
});

// ================= SERVER =================
app.listen(3001, () => {
  console.log('🚀 Server running on http://localhost:3001');
});


/*console.log('Server starting...');
const express = require('express');
const mysql = require('mysql2'); // SQLite ki jagah MySQL use karenge
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serve frontend static files
const publicPath = path.join(__dirname, '../frontend');
app.use(express.static(publicPath));

// DB CONNECTION (MySQL setup)
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "anjali02@12@2004@", // 👈 Yahan apna MySQL password likhein
    database: "aptitude_db" // 👈 Check karein aapki DB ka naam yahi hai na?
});

db.connect((err) => {
    if (err) {
        console.log("❌ MySQL Connection Failed:", err);
    } else {
        console.log("✅ MySQL Connected Successfully");
    }
});

// ================= REGISTER =================
app.post('/register', (req, res) => {
    const { name, email, password } = req.body;
    db.query('SELECT * FROM users WHERE email=?', [email], (err, result) => {
        if (err) return res.send('Database Error');
        if (result.length > 0) return res.send('Email already registered');

        db.query('INSERT INTO users (name,email,password) VALUES (?,?,?)', [name, email, password], (err) => {
            if (err) res.send('Error while registering');
            else res.send('Registered Successfully');
        });
    });
});

// ================= LOGIN =================
app.post('/login', (req, res) => {
    const { email, password } = req.body;
    db.query('SELECT * FROM users WHERE email=? AND password=?', [email, password], (err, result) => {
        if (err) return res.send({ success: false });
        if (result.length > 0) res.send({ success: true, user: result[0] });
        else res.send({ success: false });
    });
});

// ================= ADD QUESTION =================
app.post('/add-question', (req, res) => {
    const { topic, difficulty, question, optionA, optionB, optionC, optionD, correct_ans } = req.body;
    const sql = 'INSERT INTO question (topic,difficulty,question,optionA,optionB,optionC,optionD,correct_ans) VALUES (?,?,?,?,?,?,?,?)';
    db.query(sql, [topic, difficulty, question, optionA, optionB, optionC, optionD, correct_ans], (err) => {
        if (err) {
            console.log(err);
            res.send('Error');
        } else {
            res.send('Question Added');
        }
    });
});

// ================= GET QUESTIONS =================
app.get('/questions', (req, res) => {
    const { topic, difficulty } = req.query;
    db.query('SELECT * FROM question WHERE topic=? AND difficulty=?', [topic, difficulty], (err, result) => {
        if (err) res.send([]);
        else res.send(result);
    });
});

// ================= SAVE SCORE =================
app.post('/save-score', (req, res) => {
    const { user_id, score, topic, difficulty } = req.body;
    const sql = 'INSERT INTO quiz_attempt (user_id,score,topic,difficulty,attempt_date) VALUES (?,?,?,?, NOW())';
    db.query(sql, [user_id, score, topic, difficulty], (err) => {
        if (err) res.send('Error');
        else res.send('Score Saved');
    });
});

// ================= SERVER =================
app.listen(3001, () => {
    console.log('🚀 Server running on http://localhost:3001');
}); */