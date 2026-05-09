console.log('Server starting...');
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// 1. PATH CONFIGURATION (Fixed for Vercel)
const publicPath = path.join(__dirname, '../frontend');
const dbPath = path.resolve(__dirname, '../aptitude_platform.db');

app.use(express.static(publicPath));

// 2. DB CONNECTION
console.log('Connecting to SQLite at:', dbPath);
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ DB Connection Failed:', err);
    } else {
        console.log('✅ SQLite Connected');
        // Initialize Tables
        db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT UNIQUE, password TEXT)`);
        db.run(`CREATE TABLE IF NOT EXISTS question (q_id INTEGER PRIMARY KEY AUTOINCREMENT, topic TEXT, difficulty TEXT, question TEXT, optionA TEXT, optionB TEXT, optionC TEXT, optionD TEXT, correct_ans TEXT)`);
        db.run(`CREATE TABLE IF NOT EXISTS quiz_attempt (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, score INTEGER, topic TEXT, difficulty TEXT, attempt_date TEXT)`);
    }
});

// 3. ROUTES
app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

// ================= AUTH =================
app.post('/register', (req, res) => {
    const { name, email, password } = req.body;
    db.get('SELECT * FROM users WHERE email=?', [email], (err, row) => {
        if (err) return res.status(500).send('Database Error');
        if (row) return res.send('Email already registered');
        db.run('INSERT INTO users (name,email,password) VALUES (?,?,?)', [name, email, password], (err) => {
            if (err) res.status(500).send('Error while registering');
            else res.send('Registered Successfully');
        });
    });
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;
    db.get('SELECT * FROM users WHERE email=? AND password=?', [email, password], (err, row) => {
        if (err) return res.send({ success: false });
        res.send(row ? { success: true, user: row } : { success: false });
    });
});

app.post('/admin-login', (req, res) => {
    const { email, password } = req.body;
    if (email === "admin@platform.com" && password === "admin123") {
        res.send({ success: true, admin: { name: "System Admin", email } });
    } else {
        res.send({ success: false, message: "Invalid Admin Credentials" });
    }
});

// ================= QUESTIONS =================
app.post('/add-question', (req, res) => {
    const { topic, difficulty, question, optionA, optionB, optionC, optionD, correct_ans } = req.body;
    db.run('INSERT INTO question (topic,difficulty,question,optionA,optionB,optionC,optionD,correct_ans) VALUES (?,?,?,?,?,?,?,?)',
        [topic, difficulty, question, optionA, optionB, optionC, optionD, correct_ans], (err) => {
            if (err) res.status(500).send('Error');
            else res.send('Question Added');
        });
});

app.get('/questions', (req, res) => {
    const { topic, difficulty } = req.query;
    db.all('SELECT * FROM question WHERE topic=? AND difficulty=?', [topic, difficulty], (err, rows) => {
        res.send(err ? [] : rows);
    });
});

app.delete('/delete/:id', (req, res) => {
    db.run('DELETE FROM question WHERE q_id=?', [req.params.id], (err) => {
        res.send(err ? 'Error' : 'Deleted Successfully');
    });
});

// ================= PROGRESS & LEADERBOARD =================
app.post('/save-score', (req, res) => {
    const { user_id, score, topic, difficulty } = req.body;
    db.run('INSERT INTO quiz_attempt (user_id,score,topic,difficulty,attempt_date) VALUES (?,?,?,?,datetime(\'now\'))',
        [user_id, score, topic, difficulty], (err) => {
            res.send(err ? 'Error' : 'Score Saved');
        });
});

app.get('/progress/:user_id', (req, res) => {
    db.all('SELECT * FROM quiz_attempt WHERE user_id = ? ORDER BY attempt_date DESC', [req.params.user_id], (err, rows) => {
        res.send(err ? [] : rows);
    });
});

app.get('/leaderboard', (req, res) => {
    const sql = `SELECT users.name, MAX(quiz_attempt.score) as score FROM quiz_attempt 
                 JOIN users ON quiz_attempt.user_id = users.id 
                 GROUP BY users.id ORDER BY score DESC LIMIT 5`;
    db.all(sql, [], (err, rows) => {
        res.send(err ? [] : rows);
    });
});

// 4. SERVER START & EXPORT
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});

module.exports = app; // CRITICAL: Required for Vercel