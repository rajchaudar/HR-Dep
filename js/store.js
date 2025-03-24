const API_BASE_URL = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://localhost:3000/api"
    : "https://hr-dep-1.onrender.com/api";

// ✅ Fetch Store Products
async function fetchStoreProducts() {
    const productsContainer = document.getElementById("storeProducts");
    if (!productsContainer) return console.error("storeProducts container missing.");

    try {
        const response = await fetch(`${API_BASE_URL}/products/store`);
        const data = await response.json();

        productsContainer.innerHTML = ""; // Clear previous content

        if (data.success && data.products.length > 0) {
            data.products.forEach(product => {
                const productItem = `
                    <div class="bg-white shadow-md p-4 rounded-lg">
                        <img src="${product.image}" class="w-full h-40 object-cover rounded-md mb-3" alt="${product.name}">
                        <h3 class="text-lg font-bold">${product.name}</h3>
                        <p class="text-gray-700">${product.description}</p>
                        <p class="font-semibold text-blue-600 mt-2">Price: ₹${product.price}</p>
                        <button class="mt-3 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-700" 
                            onclick="addToCart('${product.name}', ${product.price})">
                            Add to Cart
                        </button>
                    </div>
                `;
                productsContainer.innerHTML += productItem;
            });
        } else {
            productsContainer.innerHTML = "<p class='text-gray-600 text-center'>No products available in the store.</p>";
        }
    } catch (error) {
        console.error("Error fetching store products:", error);
        productsContainer.innerHTML = "<p class='text-red-500 text-center'>Failed to load store products.</p>";
    }
}

function addToCart(productName, price) {
    // Get cart from localStorage or initialize a new array
    let cart = JSON.parse(localStorage.getItem("cart")) || [];

    // Check if the product is already in the cart
    const existingProduct = cart.find(item => item.name === productName);
    if (existingProduct) {
        existingProduct.quantity += 1; // Increase quantity if it exists
    } else {
        cart.push({ name: productName, price: price, quantity: 1 }); // Add new product
    }

    // Save updated cart to localStorage
    localStorage.setItem("cart", JSON.stringify(cart));

    // Update cart count in UI
    updateCartCount();

    // Show toast notification
    showToast(`🛒 ${productName} added to cart!`);
}

// Function to update cart count
function updateCartCount() {
    let cart = JSON.parse(localStorage.getItem("cart")) || [];
    document.getElementById("cartCount").textContent = cart.reduce((sum, item) => sum + item.quantity, 0);
}

// Function to show toast notification just below the navbar
function showToast(message) {
    const toast = document.createElement("div");
    toast.textContent = message;
    toast.className = "fixed top-[70px] left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded shadow-md transition-opacity duration-500 opacity-100 z-50";

    document.body.appendChild(toast);

    // Automatically fade out after 2 seconds
    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 500); // Remove after fade-out
    }, 2000);
}

// Run this function on page load to sync cart count
document.addEventListener("DOMContentLoaded", updateCartCount);

// ✅ Fetch User Details (Authentication)
async function fetchUserDetails() {
    const token = localStorage.getItem("token");
    const loginRegisterLink = document.getElementById("loginRegisterLink");
    const logoutLink = document.getElementById("logoutLink");
    const userName = document.getElementById("userName");

    if (!loginRegisterLink || !logoutLink || !userName) return;

    if (!token) {
        loginRegisterLink.classList.remove("hidden");
        logoutLink.classList.add("hidden");
        userName.textContent = "Guest";
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/user`, {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) throw new Error("Invalid response");

        const data = await response.json();
        if (data.success) {
            loginRegisterLink.classList.add("hidden");
            logoutLink.classList.remove("hidden");
            userName.textContent = data.user.name;
        } else {
            loginRegisterLink.classList.remove("hidden");
            logoutLink.classList.add("hidden");
        }
    } catch (error) {
        console.error("Error fetching user details:", error);
        loginRegisterLink.classList.remove("hidden");
        logoutLink.classList.add("hidden");
    }
}

// ✅ Logout Function
function logout() {
    localStorage.removeItem("token");
    window.location.href = "login.html";
}

// ✅ Run on Page Load
document.addEventListener("DOMContentLoaded", function () {
    fetchUserDetails();
    fetchStoreProducts();
    updateCartCount();
});