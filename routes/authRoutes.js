const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const passport = require("passport");
const session = require("express-session");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/User");
const { OAuth2Client } = require("google-auth-library");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
require("dotenv").config();

const router = express.Router();
const SECRET_KEY = process.env.JWT_SECRET;
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// 📌 **Generate Password Reset Token**
router.post('/request-set-password', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({ success: false, message: "User not found" });
        }

        // Generate reset token (valid for 15 minutes)
        const resetToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '15m' });

        user.resetToken = resetToken;
        user.tokenExpiry = Date.now() + 15 * 60 * 1000; // 15 minutes from now
        await user.save();

        // Send email with reset link
        const transporter = nodemailer.createTransport({
            service: 'Gmail',
            auth: { user: process.env.EMAIL, pass: process.env.EMAIL_PASS }
        });

        const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
        const resetLink = `${BASE_URL}/reset-password?token=${resetToken}`;
        await transporter.sendMail({
            from: process.env.EMAIL,
            to: user.email,
            subject: "Password Reset Request",
            text: `Click the link below to reset your password:\n${resetLink}`
        });

        res.json({ success: true, message: "Password reset link sent to email" });

    } catch (error) {
        console.error("❌ Error sending reset link:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});

// 📌 **Google OAuth Strategy (for Google Login Button)**
passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL,
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                let user = await User.findOne({ email: profile.emails[0].value });

                if (!user) {
                    user = new User({
                        name: profile.displayName,
                        email: profile.emails[0].value,
                        password: "GoogleAuth",
                    });
                    await user.save();
                }
                return done(null, user);
            } catch (error) {
                return done(error, null);
            }
        }
    )
);

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
    const user = await User.findById(id);
    done(null, user);
});

// 📌 **Google Token Verification (For Frontend Google Login)**
router.post("/auth/google/token", async (req, res) => {
    try {
        const { token } = req.body;

        // ✅ Verify Google Token
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        let user = await User.findOne({ email: payload.email });

        if (!user) {
            user = new User({
                name: payload.name,
                email: payload.email,
                password: "GoogleAuth",
            });
            await user.save();
        }

        // ✅ Generate JWT Token
        const jwtToken = jwt.sign({ userId: user._id }, SECRET_KEY, { expiresIn: "1h" });

        res.json({ success: true, message: "Google login successful", token: jwtToken });
    } catch (error) {
        res.status(500).json({ success: false, message: "Google authentication failed" });
    }
});

// 📌 **Google OAuth Routes (For Google Login Button)**
router.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));
router.get(
    "/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/login" }),
    async (req, res) => {
        const token = jwt.sign({ userId: req.user._id }, SECRET_KEY, { expiresIn: "1h" });
        const FRONTEND_URL = process.env.FRONTEND_URL || "http://127.0.0.1:5500/frontend/pages";
        res.redirect(`${FRONTEND_URL}/dashboard.html?token=${token}`);
    }
);

// 📌 **User Registration**
router.post("/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ success: false, message: "User already exists" });

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ name, email, password: hashedPassword });
        await newUser.save();

        res.status(201).json({ success: true, message: "User registered successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});

// 📌 **User Login**
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({ success: false, message: "User not found" });
        }

        // 🔒 If the user was registered via Google, they must set a password first
        if (user.password === "GoogleAuth") {
            return res.status(403).json({ 
                success: false, 
                message: "Please set a password first before logging in with email or use Google Login." 
            });
        }

        // ✅ Validate password for non-Google users
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(400).json({ success: false, message: "Invalid credentials" });
        }

        // ✅ Generate JWT Token
        const token = jwt.sign({ userId: user._id }, SECRET_KEY, { expiresIn: "1h" });

        res.status(200).json({ success: true, message: "Login successful", token });

    } catch (error) {
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});

// 📌 **Middleware to Verify JWT**
function authenticateToken(req, res, next) {
    const authHeader = req.headers["authorization"];
    if (!authHeader) return res.status(403).json({ success: false, message: "No token provided" });

    const token = authHeader.split(" ")[1];

    jwt.verify(token, SECRET_KEY, async (err, decoded) => {
        if (err) return res.status(403).json({ success: false, message: "Invalid token" });

        req.user = await User.findById(decoded.userId).select("-password");
        if (!req.user) return res.status(404).json({ success: false, message: "User not found in database" });

        next();
    });
}

router.post('/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);

        if (!user) {
            return res.status(400).json({ success: false, message: "Invalid token or user not found" });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        res.json({ success: true, message: "Password reset successful" });
    } catch (error) {
        console.error("❌ Error resetting password:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});

// 📌 **Protected Route (Dashboard)**
router.get("/dashboard", authenticateToken, async (req, res) => {
    res.json({ success: true, user: req.user });
});

// 📌 **Logout Route**
router.get("/logout", (req, res) => {
    req.logout(() => {
        res.json({ success: true, message: "Logged out successfully" });
    });
});

module.exports = router;
