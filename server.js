const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config({ path: "Config.env" });
const authRoutes = require('./routes/authRoutes');
const path = require('path');
const passport = require('passport');
const session = require('express-session');

const app = express();

// ✅ Add `express-session` middleware before initializing `passport`
app.use(
    session({
        secret: process.env.SESSION_SECRET || "your_secret_key",
        resave: false,
        saveUninitialized: true,
        cookie: { secure: false } // Set `true` if using HTTPS
    })
);
// ✅ Initialize Passport and use session
app.use(passport.initialize());
app.use(passport.session());

// 📌 Serve Static Frontend Files
app.use(express.static(path.join(__dirname, '../frontend')));

app.get("/", (req, res) => {
    res.send("Backend is running successfully! 🚀");
  });
  
app.get("/api", (req, res) => {
    res.json({ message: "API is working!" });
});
app.get('/reset-password', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/pages/reset-password.html'));
});

app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages/login.html'));
});

// 📌 Middleware
app.use(express.json());
app.use(cors());

// 📌 Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ Connected to MongoDB Atlas"))
    .catch(err => console.error("❌ MongoDB Connection Error:", err));

// 📌 Routes
app.use('/api', authRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
