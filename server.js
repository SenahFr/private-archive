const express = require("express");
const path = require("path");
const fs = require("fs");
const session = require("express-session");
const sqlite3 = require("sqlite3").verbose();
const multer = require("multer");
const bcrypt = require("bcrypt");

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: "supersecretkey", resave: false, saveUninitialized: false }));
app.use(express.static(path.join(__dirname, "public"))); // serve public folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure folders exist
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");
if (!fs.existsSync("database")) fs.mkdirSync("database");

// Setup SQLite
const db = new sqlite3.Database("./database/archive.db");

// Initialize tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    isAdmin INTEGER DEFAULT 0,
    pending INTEGER DEFAULT 1
  )`);

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

// Seed initial users (if table empty)
db.get("SELECT COUNT(*) AS count FROM users", async (err, row) => {
  if (row.count === 0) {
    const initialUsers = [
      { username: "user1", password: "password1", isAdmin: 1 },
      { username: "user2", password: "password2", isAdmin: 0 }
    ];

    for (const u of initialUsers) {
      const hashed = await bcrypt.hash(u.password, 10);
      db.run("INSERT INTO users (username, password, isAdmin, pending) VALUES (?, ?, ?, 0)", [u.username, hashed, u.isAdmin]);
    }
  }
});

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});
const upload = multer({ storage });

// ===== ROUTES =====

// Register
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ success: false, error: "Username and password required" });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    db.run("INSERT INTO users (username, password, isAdmin, pending) VALUES (?, ?, 0, 1)", [username, hashedPassword], function(err) {
      if (err) return res.status(500).json({ success: false, error: "Username may already exist" });
      res.json({ success: true, message: "Registration submitted. Awaiting admin approval." });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// Login
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
    if (err || !user) return res.status(400).json({ success: false, error: "Invalid credentials" });
    if (user.pending === 1) return res.status(403).json({ success: false, error: "Awaiting admin approval" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ success: false, error: "Invalid credentials" });

    req.session.user = user.username;
    req.session.isAdmin = user.isAdmin;
    res.json({ success: true, username: user.username, isAdmin: user.isAdmin });
  });
});

// Update account settings
app.post("/updateSettings", async (req, res) => {
  if (!req.session.user) return res.status(401).json({ success: false, error: "Not logged in" });

  const { currentPassword, newUsername, newPassword } = req.body;
  if (!currentPassword) return res.status(400).json({ success: false, error: "Current password required" });

  db.get("SELECT * FROM users WHERE username = ?", [req.session.user], async (err, user) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    if (!user) return res.status(404).json({ success: false, error: "User not found" });

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(400).json({ success: false, error: "Current password is incorrect" });

    const updatedUsername = newUsername && newUsername.trim() !== "" ? newUsername.trim() : user.username;
    const updatedPasswordHash = newPassword && newPassword.trim() !== "" ? await bcrypt.hash(newPassword, 10) : user.password;

    db.run("UPDATE users SET username = ?, password = ? WHERE id = ?", [updatedUsername, updatedPasswordHash, user.id], function(err2) {
      if (err2) return res.status(500).json({ success: false, error: err2.message });
      req.session.user = updatedUsername;
      res.json({ success: true });
    });
  });
});

// Logout
app.post("/logout", (req, res) => {
  if (!req.session) return res.json({ success: true });
  req.session.destroy(err => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.clearCookie('connect.sid', { path: '/' });
    res.json({ success: true });
  });
});

// Create post
app.post("/post", upload.single("media"), (req, res) => {
  if (!req.session.user) return res.status(401).json({ success: false, error: "No user session" });

  const text = req.body.text || "";
  const media = req.file ? req.file.filename : null;

  db.run("INSERT INTO posts (username, text, media) VALUES (?, ?, ?)", [req.session.user, text, media], function(err) {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, postId: this.lastID });
  });
});

// Get all posts & comments
app.get("/posts", (req, res) => {
  db.all("SELECT * FROM posts ORDER BY timestamp DESC", [], (err, posts) => {
    if (err) return res.status(500).json({ success: false });
    db.all("SELECT * FROM comments ORDER BY timestamp ASC", [], (err2, comments) => {
      if (err2) return res.status(500).json({ success: false });
      res.json({ posts, comments });
    });
  });
});

// Add comment
app.post("/comment", (req, res) => {
  const { postId, comment, username } = req.body;
  if (!postId || !comment) return res.status(400).json({ success: false });

  const commenter = username && username.trim() !== "" ? username.trim() : "Anonymous";
  db.run("INSERT INTO comments (post_id, username, comment) VALUES (?, ?, ?)", [postId, commenter, comment], function(err) {
    if (err) return res.status(500).json({ success: false });
    res.json({ success: true });
  });
});

// Delete post/comment (admin)
app.delete("/deletePost/:id", (req, res) => {
  if (!req.session.user) return res.status(401).json({ success: false });
  if (!req.session.isAdmin) return res.status(403).json({ success: false });

  const postId = req.params.id;
  db.run("DELETE FROM posts WHERE id = ?", [postId], function(err) {
    if (err) return res.status(500).json({ success: false });
    db.run("DELETE FROM comments WHERE post_id = ?", [postId]);
    res.json({ success: true });
  });
});

app.delete("/deleteComment/:id", (req, res) => {
  if (!req.session.user) return res.status(401).json({ success: false });
  if (!req.session.isAdmin) return res.status(403).json({ success: false });

  const commentId = req.params.id;
  db.run("DELETE FROM comments WHERE id = ?", [commentId], function(err) {
    if (err) return res.status(500).json({ success: false });
    res.json({ success: true });
  });
});

// Admin approve users
app.get("/pendingUsers", (req, res) => {
  if (!req.session.user) return res.status(401).json({ success: false });
  if (!req.session.isAdmin) return res.status(403).json({ success: false });

  db.all("SELECT id, username FROM users WHERE pending = 1", [], (err, users) => {
    if (err) return res.status(500).json({ success: false });
    res.json({ success: true, users });
  });
});

app.post("/approveUser/:id", (req, res) => {
  if (!req.session.user) return res.status(401).json({ success: false });
  if (!req.session.isAdmin) return res.status(403).json({ success: false });

  const userId = req.params.id;
  db.run("UPDATE users SET pending = 0 WHERE id = ?", [userId], function(err) {
    if (err) return res.status(500).json({ success: false });
    res.json({ success: true });
  });
});

// Admin create user
app.post("/admin/create-user", async (req, res) => {
  try {
    if (!req.session.user) return res.status(401).json({ success: false });
    db.get("SELECT * FROM users WHERE username = ?", [req.session.user], async (err, adminUser) => {
      if (!adminUser || adminUser.isAdmin !== 1) return res.status(403).json({ success: false });

      const { username, password, isAdmin } = req.body;
      if (!username || !password) return res.status(400).json({ success: false });

      const hashedPassword = await bcrypt.hash(password, 10);
      db.run("INSERT INTO users (username, password, isAdmin, pending) VALUES (?, ?, ?, 0)", [username, hashedPassword, isAdmin ? 1 : 0], function(err) {
        if (err) return res.status(500).json({ success: false, error: "User may already exist" });
        res.json({ success: true, userId: this.lastID });
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false });
  }
});

// Start server
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));