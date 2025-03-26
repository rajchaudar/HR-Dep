const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config({path :"config.env"});
const authRoutes = require('./routes/authRoutes');
const productsRoutes = require('./routes/productsRoutes');
const cartRoutes = require("./routes/cartRoutes");
const orderRoutes = require("./routes/orderRoutes");
const Contact = require("./models/Contact");
const path = require('path');
const bodyParser = require("body-parser");

const app = express();

// Use correct BASE URL dynamically
const BASE_URL = process.env.NODE_ENV === 'production' ? process.env.PROD_BASE_URL : process.env.LOCAL_BASE_URL;
console.log(`🔗 Running on: ${BASE_URL}`);


app.get('/reset-password', (req, res) => {
    try {
        const token = req.query.token; // Get token from query parameters
        const FRONTEND_URL = process.env.FRONTEND_URL; // ✅ Ensure this is correct

        if (!token) {
            return res.status(400).json({ success: false, message: "Token is missing." });
        }

        res.redirect(`${FRONTEND_URL}/reset-password.html?token=${token}`);
    } catch (error) {
        console.error("❌ Error in reset-password route:", error);
        res.status(500).json({ success: false, message: "Server error." });
    }
});


app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages/login.html'));
    res.sendFile(path.join(__dirname, 'HR-Dep/pages/login.html'));
});

// ✅ Use raw body only for Stripe webhooks
app.use("/api/cart/stripe-webhook", express.raw({ type: "application/json" }));
app.use(bodyParser.json());


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
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);


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

        const newContact = new Contact({ name, email, message });
        await newContact.save(); // ✅ Save to MongoDB

        res.json({ success: true, message: "Message received successfully!" });
    } catch (error) {
        console.error("❌ Error saving message:", error);
        res.status(500).json({ success: false, message: "Server error." });
    }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));