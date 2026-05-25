/*const express = require("express");
const mysql = require("mysql");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// ================= DB CONNECTION =================
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "aptitude_platform"
});

db.connect((err) => {
  if (err) {
    console.log("❌ DB Connection Failed:", err);
  } else {
    console.log("✅ MySQL Connected");
  }
}); */
const express = require('express');
const sqlite3 = require('sqlite3').verbose(); // Use SQLite, not MySQL
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/admin', express.static(path.join(__dirname, '../frontend/admin pannel')));
app.use('/user', express.static(path.join(__dirname, '../frontend/user pannel')));

// Path to your database file
const dbPath = path.resolve(__dirname, '../aptitude_platform.db');

// Connect to SQLite (No password needed!)
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ SQLite Connection Failed:', err);
    } else {
        console.log('✅ SQLite Connected Successfully');
    }
});

// Compatibility layer for MySQL's db.query in SQLite
db.query = function (sql, params, callback) {
    if (typeof params === 'function') {
        callback = params;
        params = [];
    }

    // Replace NOW() with sqlite equivalent datetime('now', 'localtime')
    let formattedSql = sql.replace(/\bNOW\(\)/gi, "datetime('now', 'localtime')");

    const isSelect = formattedSql.trim().toUpperCase().startsWith('SELECT');

    if (isSelect) {
        db.all(formattedSql, params, (err, rows) => {
            callback(err, rows || []);
        });
    } else {
        db.run(formattedSql, params, function (err) {
            callback(err, this);
        });
    }
};

// Rest of your routes...


// ================= REGISTER =================
app.post("/register", (req, res) => {
  const { name, email, password } = req.body;

  db.query("SELECT * FROM users WHERE email=?", [email], (err, result) => {
    if (err) return res.send("Database Error");

    if (result.length > 0) {
      return res.send("Email already registered");
    }

    db.query(
      "INSERT INTO users (name,email,password) VALUES (?,?,?)",
      [name, email, password],
      (err) => {
        if (err) res.send("Error while registering");
        else res.send("Registered Successfully");
      }
    );
  });
});


// ================= LOGIN =================
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  db.query(
    "SELECT * FROM users WHERE email=? AND password=?",
    [email, password],
    (err, result) => {
      if (err) return res.send({ success: false });

      if (result.length > 0) {
        const userObj = result[0];
        // Populate both id and user_id for frontend compatibility
        userObj.user_id = userObj.id;
        res.send({ success: true, user: userObj });
      } else {
        res.send({ success: false });
      }
    }
  );
});


// ================= ADD QUESTION =================
app.post("/add-question", (req, res) => {
  const { topic, difficulty, question, optionA, optionB, optionC, optionD, correct_ans } = req.body;

  db.query(
    "INSERT INTO question (topic,difficulty,question,optionA,optionB,optionC,optionD,correct_ans) VALUES (?,?,?,?,?,?,?,?)",
    [topic, difficulty, question, optionA, optionB, optionC, optionD, correct_ans],
    (err) => {
      if (err) res.send("Error");
      else res.send("Question Added");
    }
  );
});


// ================= GET QUESTIONS =================
app.get("/questions", (req, res) => {
  const { topic, difficulty } = req.query;

  let query = "SELECT * FROM question";
  let params = [];
  let conditions = [];

  if (topic) {
    conditions.push("topic = ?");
    params.push(topic);
  }
  if (difficulty) {
    conditions.push("difficulty = ?");
    params.push(difficulty);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  db.query(query, params, (err, result) => {
    if (err) res.send([]);
    else res.send(result);
  });
});


// ================= DELETE QUESTION =================
app.delete("/delete/:id", (req, res) => {
  db.query("DELETE FROM question WHERE q_id=?", [req.params.id], (err) => {
    if (err) res.send("Error");
    else res.send("Deleted Successfully");
  });
});


// ================= SAVE SCORE =================
app.post("/save-score", (req, res) => {
  const { user_id, score, topic, difficulty } = req.body;

  db.query(
    "INSERT INTO quiz_attempt (user_id,score,topic,difficulty,attempt_date) VALUES (?,?,?,?,NOW())",
    [user_id, score, topic, difficulty],
    (err) => {
      if (err) res.send("Error");
      else res.send("Score Saved");
    }
  );
});


// ================= GET PROGRESS =================
app.get("/progress/:user_id", (req, res) => {
  db.query(
    "SELECT * FROM quiz_attempt WHERE user_id=?",
    [req.params.user_id],
    (err, result) => {
      if (err) res.send([]);
      else res.send(result);
    }
  );
});


// ================= ADMIN REPORT =================
app.get("/admin/report", async (req, res) => {
  try {
    // Total questions count
    const totalQRes = await new Promise((resolve, reject) => {
      db.all("SELECT COUNT(*) as cnt FROM question", [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows[0].cnt);
      });
    });
    // User performance aggregation
    const perfQuery = `SELECT users.id as user_id, users.name,
      COUNT(qa.id) as attempts,
      SUM(qa.score) as totalScore,
      AVG(qa.score) as avgScore,
      MAX(qa.score) as bestScore
      FROM users LEFT JOIN quiz_attempt qa ON users.id = qa.user_id
      GROUP BY users.id ORDER BY totalScore DESC`;
    const perfData = await new Promise((resolve, reject) => {
      db.all(perfQuery, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    const report = perfData.map((row, idx) => {
      const best = row.bestScore || 0;
      const wrong = totalQRes - best;
      return {
        rank: idx + 1,
        user_id: row.user_id,
        name: row.name,
        attempts: row.attempts,
        totalScore: row.totalScore || 0,
        avgScore: row.avgScore ? Number(row.avgScore.toFixed(2)) : 0,
        bestScore: best,
        wrongCount: wrong > 0 ? wrong : 0,
      };
    });
    res.json({ totalQuestions: totalQRes, report });
  } catch (e) {
    console.error(e);
    res.status(500).send([]);
  }
});
app.get("/leaderboard", (req, res) => {
  db.query(
    `SELECT users.name, MAX(quiz_attempt.score) AS score 
     FROM quiz_attempt 
     JOIN users ON users.id = quiz_attempt.user_id 
     GROUP BY users.id 
     ORDER BY score DESC 
     LIMIT 5`,
    (err, result) => {
      if (err) res.send([]);
      else res.send(result);
    }
  );
});

// ================= ADMIN LOGIN =================
app.post("/admin-login", (req, res) => {
  const { email, password } = req.body;
  if (email === "admin@platform.com" && password === "admin123") {
    res.send({ success: true, admin: { name: "System Admin", email } });
  } else {
    res.send({ success: false, message: "Invalid Credentials" });
  }
});

// ================= SERVER =================
app.listen(3001, () => {
  console.log("🚀 Server running on port 3001");
});

module.exports = app;