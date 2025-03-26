const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken"); // ✅ JWT for authentication
const Cart = require("../models/Cart");
const Product = require("../models/Product");
const Order = require("../models/Order");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const authMiddleware = require("../Middleware/authMiddleware");
require('dotenv').config({path :"config.env"});


// ✅ Verify JWT Token
function verifyToken(req, res, next) {
    const token = req.header("Authorization")?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Access denied. No token provided." });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = { userId: decoded.userId };
        next();
    } catch (err) {
        res.status(400).json({ error: "Invalid token." });
    }
}

// ✅ Get User's Cart
router.get("/", verifyToken, async (req, res) => {
    try {
        let cart = await Cart.findOne({ userId: req.user.userId }).populate("items.productId");
        if (!cart) return res.json({ items: [], total: 0 });

        let total = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        res.json({ items: cart.items, total });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// ✅ Add Item to Cart
router.post("/add", verifyToken, async (req, res) => {
    try {
        // console.log("🔹 Received Cart Add Request");
        // console.log("🔹 req.user:", req.user); // ✅ Debugging
        
        if (!req.user || !req.user.userId) {  
            return res.status(400).json({ error: "User ID is missing from token." });
        }

        const { productId, quantity } = req.body;
        // console.log("🔹 Product ID:", productId, "Quantity:", quantity); // ✅ Debugging

        if (!productId || !quantity) {
            return res.status(400).json({ error: "Product ID and quantity are required." });
        }

        let cart = await Cart.findOne({ userId: req.user.userId });
        if (!cart) {
            console.log("🔹 No existing cart. Creating new cart.");
            cart = new Cart({ userId: req.user.userId, items: [] });
        }

        const product = await Product.findById(productId);
        if (!product) {
            console.log("❌ Product Not Found:", productId);
            return res.status(404).json({ error: "Product not found" });
        }

        let itemIndex = cart.items.findIndex(item => item.productId.toString() === productId);
        if (itemIndex > -1) {
            cart.items[itemIndex].quantity += quantity;
        } else {
            cart.items.push({ productId, name: product.name, price: product.price, quantity });
        }

        await cart.save();
        // console.log("✅ Item added to cart successfully:", cart);   // ✅ Debugging
        res.json({ success: true, message: "Item added to cart", cart });

    } catch (err) {
        console.error("❌ Cart Add Error:", err);
        res.status(500).json({ error: "Server error", details: err.message });
    }
});

// ✅ Update Item Quantity
router.put("/update", verifyToken, async (req, res) => {
    const { productId, quantity } = req.body;

    try {
        let cart = await Cart.findOne({ userId: req.user.userId }); // 🔴 FIXED
        if (!cart) return res.status(404).json({ error: "Cart not found" });

        let itemIndex = cart.items.findIndex(item => item.productId.toString() === productId);
        if (itemIndex === -1) return res.status(404).json({ error: "Item not found in cart" });

        cart.items[itemIndex].quantity = quantity;
        if (cart.items[itemIndex].quantity <= 0) cart.items.splice(itemIndex, 1);

        await cart.save();
        res.json(cart);
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// ✅ Remove Item from Cart
router.delete("/remove/:productId", verifyToken, async (req, res) => {
    try {
        let cart = await Cart.findOne({ userId: req.user.userId }); // 🔴 FIXED
        if (!cart) return res.status(404).json({ error: "Cart not found" });

        cart.items = cart.items.filter(item => item.productId.toString() !== req.params.productId);
        await cart.save();
        res.json(cart);
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// ✅ Clear Cart After Checkout
router.delete("/clear", verifyToken, async (req, res) => {
    try {
        await Cart.findOneAndDelete({ userId: req.user.userId }); // 🔴 FIXED
        res.json({ message: "Cart cleared successfully" });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

router.get("/count", verifyToken, async (req, res) => {
    try {
        let cart = await Cart.findOne({ userId: req.user.userId });
        if (!cart) return res.json({ count: 0 });

        let itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
        res.json({ count: itemCount });
    } catch (err) {
        console.error("❌ Error fetching cart count:", err);
        res.status(500).json({ error: "Server error" });
    }
});

// ✅ Checkout Route - Collect User Details & Process Payment
router.post("/checkout", authMiddleware, async (req, res) => {
    try {
        const { name, email, contact, address } = req.body;
        const userId = req.user.userId;

        console.log("🛑 Token Verified - User ID:", userId);

        // ✅ Validate Address
        if (!name || !email || !contact || !address.line1 || !address.city || !address.state || !address.postal_code) {
            return res.status(400).json({ error: "All address details are required." });
        }

        // ✅ Fetch User's Cart
        let cart = await Cart.findOne({ userId }).populate("items.productId");
        console.log("🛒 Cart Data:", cart);

        if (!cart || cart.items.length === 0) {
            console.log("❌ No items in cart.");
            return res.status(400).json({ error: "Cart is empty" });
        }

        // ✅ Calculate Total Amount
        let totalAmount = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        console.log("🛒 Total Amount:", totalAmount);

        // ✅ Create Stripe Payment Intent
        console.log("✅ Creating Payment Intent...");
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(totalAmount * 100), // Convert to cents
            currency: "usd",
            payment_method_types: ["card"],
            description: `Order for ${cart.items.length} items`,
            metadata: { userId, orderId: new Date().getTime().toString() },
            shipping: {
                name: name,
                address: {
                    line1: address.line1,
                    city: address.city,
                    state: address.state,
                    postal_code: address.postal_code,
                    country: "US",
                }
            },
            receipt_email: email,
        });

        console.log("✅ Payment Intent Created:", paymentIntent.id);

        // ✅ Save Order in Database
        const newOrder = new Order({
            userId,
            name,
            email,
            contact,
            address,
            items: cart.items.map(item => ({
                productId: item.productId._id,
                name: item.productId.name,
                price: item.productId.price,
                quantity: item.quantity
            })),
            totalAmount,
            paymentIntentId: paymentIntent.id,
            status: "Pending",
            createdAt: new Date(),
        });

        await newOrder.save();
        console.log("✅ Order Saved in Database:", newOrder._id);

        // ✅ Clear Cart After Checkout
        await Cart.findOneAndDelete({ userId });
        console.log("🛒 Cart Cleared for User:", userId);

        // ✅ Send Response to Frontend
        res.json({
            success: true,
            message: "Order placed successfully!",
            order: newOrder,
            clientSecret: paymentIntent.client_secret
        });

    } catch (err) {
        console.error("❌ Checkout Error:", err);
        res.status(500).json({ error: "Server error", details: err.message });
    }
});


// ✅ Fetch User Orders
router.get("/orders", authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        const orders = await Order.find({ userId }).sort({ createdAt: -1 });

        res.json({ success: true, orders });
    } catch (err) {
        console.error("❌ Fetch Orders Error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;