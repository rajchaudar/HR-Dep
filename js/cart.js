const API_BASE_URL = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://localhost:3000/api"
    : "https://hr-dep-1.onrender.com/api";

// ✅ Check if User is Logged In (Improved)
async function checkUserAuthentication() {
    const token = localStorage.getItem("token");

    // ✅ Get elements safely
    const loginRegisterLink = document.getElementById("loginRegisterLink");
    const logoutLink = document.getElementById("logoutLink");
    const userName = document.getElementById("userName");

    // ✅ If any element is missing, log an error and return
    if (!loginRegisterLink || !logoutLink || !userName) {
        console.error("❌ One or more authentication elements are missing in the HTML.");
        return; // Prevents function from running further
    }

    if (!token) {
        console.warn("⚠ No token found! Redirecting to login.");
        window.location.href = "login.html";
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/user`, {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) throw new Error("User not authenticated");

        const data = await response.json();
        if (!data.success || !data.user || !data.user.name) {
            throw new Error("API response missing user data");
        }

        // ✅ Update UI only if elements exist
        userName.textContent = data.user.name;
        loginRegisterLink.classList.add("hidden");
        logoutLink.classList.remove("hidden");

    } catch (error) {
        console.error("❌ User authentication error:", error.message);
        alert("Authentication failed! Redirecting to login.");
        localStorage.removeItem("token");
        window.location.href = "login.html";
    }
}

// ✅ Ensure function runs after DOM loads
document.addEventListener("DOMContentLoaded", checkUserAuthentication);

// ✅ Display Cart Items
function displayCartItems() {
    let cart = JSON.parse(localStorage.getItem("cart")) || [];
    const cartContainer = document.getElementById("cartItems");
    
    cartContainer.innerHTML = "";

    if (cart.length === 0) {
        cartContainer.innerHTML = "<p class='text-gray-600 text-center'>Your cart is empty.</p>";
        return;
    }

    cart.forEach((item, index) => {
        cartContainer.innerHTML += `
            <div class="bg-white shadow-md p-4 rounded-lg">
                <h3 class="text-lg font-bold">${item.name}</h3>
                <p class="text-gray-700">Price: ₹${item.price}</p>
                <p>Quantity: ${item.quantity}</p>
                <button class="mt-3 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-700" onclick="removeItem(${index})">
                    Remove
                </button>
            </div>
        `;
    });
}

async function checkout() {
    const token = localStorage.getItem("token");

    // If user is not logged in, redirect to login
    if (!token) {
        showToast("Please log in to proceed to checkout!", "bg-red-600");
        setTimeout(() => {
            window.location.href = "login.html";
        }, 2000);
        return;
    }

    try {
        // Check if token is valid
        const response = await fetch(`${API_BASE_URL}/user`, {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) throw new Error("Invalid session");

        const data = await response.json();
        if (data.success) {
            showToast("Proceeding to checkout... (Payment Integration Pending)", "bg-blue-600");

            // Simulate a delay before actual checkout
            setTimeout(() => {
                showToast("Payment feature coming soon! Stay tuned.", "bg-green-600");
            }, 3000);
        } else {
            throw new Error("User session expired");
        }
    } catch (error) {
        showToast("Session expired! Please log in again.", "bg-red-600");
        localStorage.removeItem("token");
        setTimeout(() => {
            window.location.href = "login.html";
        }, 2000);
    }
}

function showToast(message, bgColor = "bg-blue-600") {
    const toast = document.createElement("div");
    toast.textContent = message;

    toast.className = `fixed top-16 left-1/2 transform -translate-x-1/2 ${bgColor} text-white px-4 py-2 rounded shadow-md transition-opacity duration-500 opacity-100`;

    document.body.appendChild(toast);

    // Automatically fade out after 2.5 seconds
    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 500);
    }, 2500);
}


// 🛒 Load cart from localStorage
let cart = JSON.parse(localStorage.getItem("cart")) || [];

// 📌 Function to render cart
function loadCart() {
    cart = JSON.parse(localStorage.getItem("cart")) || [];
    const cartContainer = document.getElementById("cartItems");
    cartContainer.innerHTML = "";
    let totalPrice = 0;

    if (!cartContainer) {
        console.error("❌ Cart container not found! Check your HTML ID.");
        return;
    }

    if (cart.length === 0) {
        cartContainer.innerHTML = `<p class="text-center text-gray-500">Your cart is empty.</p>`;
        document.getElementById("cartTotal").textContent = `₹0.00`;
        return;
    }

    cart.forEach((item, index) => {
        const itemTotal = item.price * item.quantity;
        totalPrice += itemTotal;

        const cartItem = document.createElement("div");
        cartItem.className = "bg-white p-4 rounded shadow flex flex-col items-start";

        cartItem.innerHTML = `
            <h3 class="font-semibold">${item.name}</h3>
            <p class="text-gray-600">Price: ₹${item.price}</p>
            <div class="flex items-center space-x-2 mt-2">
                <button class="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-700" onclick="updateQuantity(${index}, -1)">➖</button>
                <span class="px-4">${item.quantity}</span>
                <button class="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-700" onclick="updateQuantity(${index}, 1)">➕</button>
            </div>
            <p class="text-gray-700 font-bold mt-2">Total: ₹${itemTotal.toFixed(2)}</p>
            <button class="bg-red-500 text-white px-4 py-2 rounded mt-2 hover:bg-red-700" onclick="removeItem(${index})">Remove</button>
        `;

        cartContainer.appendChild(cartItem);
    });

    document.getElementById("cartTotal").textContent = `₹${totalPrice.toFixed(2)}`;
    saveCart(); // ✅ Save every time UI updates
}

// 📌 Function to update quantity
function updateQuantity(index, change) {
    if (cart[index]) {
        cart[index].quantity += change;

        if (cart[index].quantity <= 0) {
            cart.splice(index, 1); // 🚨 Remove item if quantity is 0
        }
        
        saveCart(); // ✅ Save to localStorage
        loadCart(); // ✅ Refresh cart
    }
}


function saveCart() {
    localStorage.setItem("cart", JSON.stringify(cart)); // ✅ Always update localStorage
}

function removeItem(index) {
    cart.splice(index, 1);
    saveCart();  // ✅ Save updated cart
    loadCart();  // ✅ Reload UI
}


// ✅ Run on Page Load
document.addEventListener("DOMContentLoaded", function () {
    checkUserAuthentication(); // Ensure user is logged in
    displayCartItems();
    loadCart();
});