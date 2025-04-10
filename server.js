const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config({ path: "config.env" });
const authRoutes = require('./routes/authRoutes');
const productsRoutes = require('./routes/productsRoutes');
const cartRoutes = require("./routes/cartRoutes");
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


// app.get('/login.html', (req, res) => {
//     res.sendFile(path.join(__dirname, 'pages/login.html'));
//     res.sendFile(path.join(__dirname, 'HR-Dep/pages/login.html'));
// });

// ✅ Use raw body only for Stripe webhooks
app.use("/api/cart/stripe-webhook", express.raw({ type: "application/json" }));
app.use(bodyParser.json());


// Middleware
app.use(express.json());
app.use(cors());
app.use((req, res, next) => {
    const allowedOrigins = [process.env.FRONTEND_URL];
    const origin = req.headers.origin;
    const publicRoutes = ['/', '/reset-password'];

    const isBrowser = req.headers.accept && req.headers.accept.includes('text/html');

    if (publicRoutes.includes(req.path) || allowedOrigins.includes(origin)) {
        return next();
    }

    if (isBrowser) {
        return res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>Access Restricted</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        background-color: #f9f9f9;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        height: 100vh;
                        margin: 0;
                    }
                    .box {
                        text-align: center;
                        padding: 30px;
                        background-color: white;
                        border-radius: 8px;
                        box-shadow: 0 4px 10px rgba(0,0,0,0.1);
                    }
                    h1 {
                        color: #e74c3c;
                    }
                    a {
                        color: #3498db;
                        text-decoration: none;
                    }
                </style>
            </head>
            <body>
                <div class="box">
                    <h1>🚫 Access Restricted</h1>
                    <p>This page is not publicly accessible.</p>
                    <p><a href="/">Return to Home</a></p>
                </div>
            </body>
            </html>
        `);
    }

    return res.status(403).json({ success: false, message: "⛔ Access denied: Invalid origin or route." });
});

// ✅ Public Routes
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Thank You</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(135deg, #f5f7fa, #c3cfe2);
      margin: 0;
      padding: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      color: #2c3e50;
      animation: fadeIn 1s ease;
    }

    .message-box {
      background: white;
      padding: 40px 30px;
      border-radius: 12px;
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.1);
      text-align: center;
      max-width: 480px;
    }

    h1 {
      font-size: 2.2rem;
      color: #27ae60;
      margin-bottom: 10px;
    }

    p {
      font-size: 1.05rem;
      margin: 10px 0;
    }

    .origin-note {
      margin-top: 20px;
      font-size: 0.95rem;
      color: #c0392b;
      background-color: #fdecea;
      padding: 12px;
      border-radius: 6px;
      display: none;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
  </style>
</head>
<body>
  <div class="message-box">
    <h1>🎉 Thank You!</h1>
    <p>Your message has been received with gratitude.</p>
    <p>We're genuinely happy you reached out. Expect a response from us soon. In the meantime, stay awesome!</p>

    <div id="origin-warning" class="origin-note">
      ⚠️ You seem to have accessed this page from an unknown source. For security reasons, certain features may not be available.
    </div>
  </div>

  <script>
    // Optional: dynamically show note if needed (e.g., based on origin or query param)
    const isExternal = window.location.search.includes("external=true");
    if (isExternal) {
      document.getElementById("origin-warning").style.display = 'block';
    }
  </script>
</body>
</html>
    `);
});

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ Connected to MongoDB Atlas"))
    .catch(err => console.error("❌ MongoDB Connection Error:", err));

// Routes
app.use('/api', authRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/cart", cartRoutes);


// // Serve frontend in production
// if (process.env.NODE_ENV === 'production') {
//     app.use(express.static(path.join(__dirname, '../frontend')));
//     app.get('*', (req, res) => {
//         res.sendFile(path.join(__dirname, '../frontend/index.html'));
//     });
// }



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