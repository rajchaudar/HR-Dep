const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config({path :"config.env"});
const authRoutes = require('./routes/authRoutes');
const productsRoutes = require('./routes/productsRoutes');
const Contact = require("./models/Contact");
const path = require('path');

const app = express();

// Use correct BASE URL dynamically
const BASE_URL = process.env.NODE_ENV === 'production' ? process.env.PROD_BASE_URL : process.env.LOCAL_BASE_URL;
console.log(`🔗 Running on: ${BASE_URL}`);

// Middleware
app.use(express.json());
app.use(cors());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ Connected to MongoDB Atlas"))
    .catch(err => console.error("❌ MongoDB Connection Error:", err));

// Routes
app.use('/api', authRoutes);
app.use("/api/products", productsRoutes);

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../frontend')));
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../frontend/index.html'));
    });
}



//Contact form
app.post("/api/contact", async (req, res) => {
    try {
        const { name, email, message } = req.body;
        if (!name || !email || !message) {
            return res.status(400).json({ success: false, message: "All fields are required." });
        }
        res.json({ success: true, message: "Message received successfully!" });
    } catch (error) {
        console.error("Error handling contact form:", error);
        res.status(500).json({ success: false, message: "Server error." });
    }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));