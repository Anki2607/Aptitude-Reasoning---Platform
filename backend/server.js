const express = require("express");
const mysql = require("mysql");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// DB CONNECTION
/*const db = mysql.createConnection({
  host: "localhost",
  user: "root", 
  password: "YOUR_NEW_PASSWORD", // Put your MySQL Root password here
  database: "aptitude_platform"
});*/

const db = mysql.createConnection({
  host: "localhost",
  user: "root", 
  password: "anjali02@12@2004@",
  database: "aptitude_platform"
});

db.connect((err) => {
  if (err) {
    console.log("❌ DB Connection Failed:", err);
  } else {
    console.log("✅ MySQL Connected");
  }
});


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
        res.send({ success: true, user: result[0] });
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

  db.query(
    "SELECT * FROM question WHERE topic=? AND difficulty=?",
    [topic, difficulty],
    (err, result) => {
      if (err) res.send([]);
      else res.send(result);
    }
  );
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


// ================= 🏆 LEADERBOARD (NEW) =================
app.get("/leaderboard", (req, res) => {
  db.query(
    `SELECT users.name, MAX(quiz_attempt.score) AS score 
     FROM quiz_attempt 
     JOIN users ON users.user_id = quiz_attempt.user_id 
     GROUP BY users.user_id 
     ORDER BY score DESC 
     LIMIT 5`,
    (err, result) => {
      if (err) res.send([]);
      else res.send(result);
    }
  );
});


// ================= SERVER =================
app.listen(3001, () => {
  console.log("🚀 Server running on port 3001");
});