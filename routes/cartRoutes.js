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
router.post("/checkout", verifyToken, async (req, res) => {
    
        const { name, email, contact, address } = req.body;
        
        const userId=req.user?.userId
        console.log("📥 Checkout Request Data:", name, email, contact, address);

        // ✅ Ensure userId is available
        if (!userId) {
            console.error("❌ Error: userId is missing in request body");
            return res.status(400).json({ error: "User ID is required." });
        }

        // ✅ Ensure all required fields exist
        if (!name || !email || !contact || !address || !address.line1 || !address.city || !address.state || !address.postal_code) {
            return res.status(400).json({ error: "All user details and address are required." });
        }

        // ✅ Fetch the user's cart
        const userCart = await Cart.findOne({ userId }).populate("items.productId"); // 🔴 Fixed

        if (!userCart || userCart.items.length === 0) {
            return res.status(400).json({ error: "Cart is empty. Add items before checkout." });
        }

       // ✅ Calculate total amount dynamically
let totalAmount = userCart.items.reduce((sum, item) => {
    if (item.productId && item.productId.price) {
        return sum + item.productId.price * item.quantity;
    }
    return sum;
}, 0);
        
totalAmount = Math.round(totalAmount * 100); // Convert to cents for Stripe

        console.log("💰 Total Amount:", totalAmount);

        // ✅ Create Stripe PaymentIntent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: totalAmount,
            currency: "usd",
            payment_method_types: ["card"],
            receipt_email: email,
            description: `Purchase from MedSupply - Order by ${name}`,
            shipping: {
                name: name,
                address: {
                    line1: address.line1,
                    city: address.city,
                    state: address.state,
                    postal_code: address.postal_code,
                    country: "IN",
                },
            },
        });

        const newOrder = await Order.create({
            userId: userId,
            name: name,
            contact: contact,
            email: email,
            address: address,
            items: userCart.items, // ✅ Use userCart.items, not entire userCart
            paymentIntentId: paymentIntent.id, // ✅ Use paymentIntent.id, not entire object
            totalAmount: totalAmount / 100, // ✅ Convert cents to dollars if needed
        });
        
        // ❌ REMOVE `await Order.save()`
        console.log("✅ Order Placed Successfully:", newOrder);
        res.json({ clientSecret: paymentIntent.client_secret, orderId: newOrder._id });
        
        
});

// ✅ Update Order Status Route
router.put("/orderstatus/:orderId", verifyToken, async (req, res) => {
    try {
        const { status } = req.body;
        const { orderId } = req.params;

        // ✅ Validate input
        if (!status) {
            return res.status(400).json({ error: "Order status is required" });
        }

        // ✅ Find and update the order
        const updatedOrder = await Order.findByIdAndUpdate(
            orderId,
            { status },
            { new: true } // ✅ Return the updated document
        );

        if (!updatedOrder) {
            return res.status(404).json({ error: "Order not found" });
        }

        console.log(`✅ Order ${orderId} status updated to: ${status}`);
        res.json({ success: true, message: "Order status updated", order: updatedOrder });

    } catch (error) {
        console.error("❌ Order Status Update Error:", error);
        res.status(500).json({ error: "Server error" });
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