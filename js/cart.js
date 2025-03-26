const API_BASE_URL = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://localhost:3000/api"
    : "https://hr-dep-1.onrender.com/api";

 // Function to fetch user details and update the UI
 async function fetchUserDetails() {
    const token = localStorage.getItem("token");
    
    // Ensure elements exist before manipulating them
    const loginRegisterLink = document.getElementById("loginRegisterLink");
    const logoutLink = document.getElementById("logoutLink");
    const userName = document.getElementById("userName");

    if (!loginRegisterLink || !logoutLink || !userName) {
        console.error("One or more authentication elements are missing in the HTML.");
        return;
    }

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

        if (!response.ok) {
            throw new Error("Invalid response");
        }

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

// Logout function
function logout() {
    localStorage.removeItem("token");
    window.location.href = "login.html";
}

// ✅ Fetch and Display Cart Items
async function fetchCartItems() {
    const token = localStorage.getItem("token");
    if (!token) {
        document.getElementById("cartItems").innerHTML = "<p>Please <a href='login.html'>log in</a> to view your cart.</p>";
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/cart`, {
            method: "GET",
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (!response.ok) throw new Error("Failed to fetch cart");

        const data = await response.json();
        console.log("🔹 Cart Data:", data);

        if (!data.items || data.items.length === 0) {
            document.getElementById("cartItems").innerHTML = "<p>Your cart is empty.</p>";
            document.getElementById("cartTotal").innerText = "0";
            return;
        }

        let total = 0;
        document.getElementById("cartItems").innerHTML = data.items.map(item => {
            total += item.price * item.quantity;
            return `
                <div class="bg-white p-4 rounded-lg shadow-md flex">
                    <img src="${item.productId.image}" alt="${item.productId.name}" class="w-24 h-24 object-cover rounded-md">
                    <div class="ml-4">
                        <h3 class="font-bold">${item.productId.name}</h3>
                        <p class="text-gray-700">Price: ₹${item.price}</p>
                        <p class="text-gray-700">Quantity: 
                            <button onclick="updateQuantity('${item.productId._id}', ${item.quantity - 1})" class="px-2 bg-gray-200 rounded">-</button>
                            <span>${item.quantity}</span>
                            <button onclick="updateQuantity('${item.productId._id}', ${item.quantity + 1})" class="px-2 bg-gray-200 rounded">+</button>
                        </p>
                        <button class="mt-2 bg-red-500 text-white px-4 py-1 rounded hover:bg-red-700" 
                            onclick="removeFromCart('${item.productId._id}')">Remove</button>
                    </div>
                </div>
            `;
        }).join("");

        document.getElementById("cartTotal").innerText = total.toFixed(2);
    } catch (error) {
        console.error("❌ Error fetching cart:", error);
        document.getElementById("cartItems").innerHTML = "<p>Failed to load cart items.</p>";
    }
}

// ✅ Update Item Quantity
async function updateQuantity(productId, quantity) {
    if (quantity < 1) return removeFromCart(productId);

    const token = localStorage.getItem("token");
    try {
        const response = await fetch(`${API_BASE_URL}/cart/update`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ productId, quantity })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error);

        fetchCartItems(); // Refresh the cart after update
    } catch (error) {
        console.error("❌ Error updating quantity:", error);
    }
}

// ✅ Remove Item from Cart
async function removeFromCart(productId) {
    const token = localStorage.getItem("token");
    try {
        const response = await fetch(`${API_BASE_URL}/cart/remove/${productId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error);

        fetchCartItems(); // Refresh cart
    } catch (error) {
        console.error("❌ Error removing item:", error);
    }
}


function checkout() {
    const token = localStorage.getItem("token");
    if (!token) {
        alert("Please log in to proceed with checkout.");
        window.location.href = "login.html";
        return;
    }

    fetch(`${API_BASE_URL}/cart`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${token}` }
    })
    .then(response => response.json())
    .then(data => {
        if (!data.items || data.items.length === 0) {
            alert("Your cart is empty. Please add items before checkout.");
            return;
        }

        window.location.href = "checkout.html";
    })
    .catch(error => {
        console.error("❌ Error fetching cart:", error);
        alert("Failed to fetch cart details.");
    });
}

// ✅ Run on Page Load
document.addEventListener("DOMContentLoaded", function () {
    fetchUserDetails();
    fetchCartItems();
});