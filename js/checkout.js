const API_BASE_URL = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://localhost:3000/api"
    : "https://hr-dep-1.onrender.com/api";

const stripe = Stripe("pk_test_51PktNASFRtv588FKNJTtUvfMUXEnkFK1aGeRIdBT9PxICcVxYb99NtuKxpMZxGSFy8YfOU2SmceVspuVXLhBjeia00W4KD5BVW"); 
let clientSecret = "";
let orderId = "";
let card; // ✅ Declare card globally

// ✅ Function to Decode JWT Token and Extract User ID
function getUserIdFromToken(token) {
    try {
        const payload = JSON.parse(atob(token.split(".")[1])); // Decode Base64 JWT payload
        return payload.userId; // Extract userId
    } catch (error) {
        console.error("❌ Error decoding token:", error);
        return null;
    }
}

// ✅ Ensure DOM elements are correctly selected
document.addEventListener("DOMContentLoaded", () => {
    console.log("✅ DOM Loaded Successfully");

    // ✅ Select the forms correctly
    const checkoutForm = document.getElementById("checkout-form");
    const paymentForm = document.getElementById("payment-form");

    const token = localStorage.getItem("token");
    if (!token) {
        alert("Please log in to proceed.");
        window.location.href = "login.html";
        return;
    }

    const userId = getUserIdFromToken(token);
    if (!userId) {
        alert("Invalid session. Please log in again.");
        localStorage.removeItem("token");
        window.location.href = "login.html";
        return;
    }

    console.log("✅ Extracted User ID:", userId); // Debugging

    if (checkoutForm) {
        console.log("✅ Checkout Form Found");
        checkoutForm.addEventListener("submit", async function (event) {
            event.preventDefault();
            startCheckout();
        });
    } else {
        console.error("❌ Error: `checkoutForm` Not Found");
    }

    if (paymentForm) {
        console.log("✅ Payment Form Found");
        paymentForm.addEventListener("submit", async function (event) {
            event.preventDefault();
            processPayment();
        });
    } else {
        console.error("❌ Error: `paymentForm` Not Found");
    }
});

// ✅ Start Checkout: Fetch Client Secret & Order ID
async function startCheckout() {
    const token = localStorage.getItem("token");
    if (!token) {
        alert("Please log in to proceed.");
        window.location.href = "login.html";
        return;
    }

    const userId = getUserIdFromToken(token); // ✅ Extract userId from token
    if (!userId) {
        alert("Invalid session. Please log in again.");
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/cart/checkout`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                userId: userId,  // ✅ Pass extracted userId
                name: document.getElementById("name").value,
                email: document.getElementById("email").value,
                contact: document.getElementById("contact").value,
                address: {
                    line1: document.getElementById("addressLine1").value,
                    city: document.getElementById("city").value,
                    state: document.getElementById("state").value,
                    postal_code: document.getElementById("postalCode").value,
                }
            })
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Checkout failed.");

        clientSecret = result.clientSecret;
        orderId = result.orderId;

        document.getElementById("payment-section").style.display = "block"; 

        const elements = stripe.elements();
        card = elements.create("card");
        card.mount("#card-element");
    } catch (error) {
        console.error("❌ Error:", error);
        alert(error.message || "Failed to start checkout.");
    }
}

async function clearCart() {
    try {
        const token = localStorage.getItem("token");
        if (!token) return;

        const response = await fetch(`${API_BASE_URL}/cart/clear`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        const result = await response.json();
        console.log("✅ Cart Cleared:", result);

        if (!response.ok) {
            throw new Error(result.error || "Failed to clear cart.");
        }

    } catch (error) {
        console.error("❌ Cart Clear Error:", error);
    }
}

// ✅ Process Payment using Stripe
async function processPayment() {
    if (!clientSecret || typeof clientSecret !== "string") {
        alert("Payment session not initialized. Please retry checkout.");
        return;
    }

    if (!card) { 
        console.error("❌ Card instance is not initialized.");
        alert("Payment form is not ready. Refresh and try again.");
        return;
    }

    const { paymentIntent, error } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card },
        receipt_email: document.getElementById("email").value // ✅ Use receipt email properly
    });

    if (error) {
        if (error.code === "card_declined") {
            alert("❌ Payment declined: " + error.message);
        } else {
            alert("❌ Payment failed: " + error.message);
        }

        return;
    } else {
        alert("✅ Payment Successful!");

        // ✅ Update Order Status to "Paid"
        await fetch(`${API_BASE_URL}/cart/orderstatus/${orderId}`, { 
            method: "PUT",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem("token")}` // ✅ Include token
            },
            body: JSON.stringify({ status: "Paid" })
        });

        await clearCart()

        // ✅ Redirect to Success Page
        window.location.href = "order-success.html";
    }
}
