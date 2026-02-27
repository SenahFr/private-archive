const express = require("express");
const path = require("path");
const fs = require("fs");
const session = require("express-session");
const sqlite3 = require("sqlite3").verbose();
const multer = require("multer");

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: "supersecretkey", resave: false, saveUninitialized: false }));
app.use(express.static(path.join(__dirname, "public")));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure folders exist
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");
if (!fs.existsSync("database")) fs.mkdirSync("database");

// Setup SQLite
const db = new sqlite3.Database("./database/archive.db");

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    text TEXT,
    media TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER,
    username TEXT,
    comment TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// Hardcoded users
const users = [
  { username: "user1", password: "password1", isAdmin: true },
  { username: "user2", password: "password2", isAdmin: false }
];

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});
const upload = multer({ storage });

// Routes
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  const user = users.find(
    u => u.username === username && u.password === password
  );

  if (user) {
    req.session.user = user.username;
    res.json({
      success: true,
      username: user.username,
      isAdmin: user.isAdmin
    });
  } else {
    res.status(400).json({ success: false });
  }
});

app.post("/post", upload.single("media"), (req, res) => {
  console.log("POST /post called");
  console.log("req.body:", req.body);
  console.log("req.file:", req.file);
  console.log("req.session.user:", req.session.user);

  if (!req.session.user) {
    console.log("No user in session!");
    return res.status(401).json({ success: false, error: "No user session" });
  }

  const text = req.body.text || "";
  const media = req.file ? req.file.filename : null;

  db.run(
    `INSERT INTO posts (username, text, media) VALUES (?, ?, ?)`,
    [req.session.user, text, media],
    function(err) {
      if (err) {
        console.error("DB INSERT ERROR:", err.message);
        return res.status(500).json({ success: false, error: err.message });
      }
      console.log("Post inserted with ID:", this.lastID);
      res.json({ success: true, postId: this.lastID });
    }
  );
});

app.post("/comment", (req, res) => {

  const { postId, comment, username } = req.body;

  if (!postId || !comment) {
    return res.status(400).json({ success: false });
  }

  const commenter = username && username.trim() !== ""
    ? username.trim()
    : "Anonymous";

  db.run(
    `INSERT INTO comments (post_id, username, comment) VALUES (?, ?, ?)`,
    [postId, commenter, comment],
    function(err) {
      if (err) {
        console.error("COMMENT INSERT ERROR:", err);
        return res.status(500).json({ success: false });
      }
      res.json({ success: true });
    }
  );
});

app.get("/posts", (req, res) => {
  db.all(`SELECT * FROM posts ORDER BY timestamp DESC`, [], (err, posts) => {
    if (err) return res.status(500).json({ success: false });
    db.all(`SELECT * FROM comments ORDER BY timestamp ASC`, [], (err2, comments) => {
      if (err2) return res.status(500).json({ success: false });
      res.json({ posts, comments });
    });
  });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.delete("/deletePost/:id", (req, res) => {
    const postId = req.params.id;
    // Only allow admins
    if (!req.session.user) return res.status(401).json({ success: false });
    const user = users.find(u => u.username === req.session.user);
    if (!user?.isAdmin) return res.status(403).json({ success: false });

    db.run("DELETE FROM posts WHERE id = ?", [postId], function(err) {
        if (err) return res.status(500).json({ success: false });
        db.run("DELETE FROM comments WHERE post_id = ?", [postId]);
        res.json({ success: true });
    });
});
app.delete("/deleteComment/:id", (req, res) => {
    const commentId = req.params.id;

    if (!req.session.user)
        return res.status(401).json({ success: false });

    const user = users.find(u => u.username === req.session.user);

    if (!user || !user.isAdmin)
        return res.status(403).json({ success: false });

    db.run("DELETE FROM comments WHERE id = ?", [commentId], function(err) {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true });
    });
});

// Start server
app.listen(PORT, () => console.log(`Running on http://localhost:${PORT}`));