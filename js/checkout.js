async function checkout() {
    const token = localStorage.getItem("token");
    if (!token) {
        showToast("You need to log in to proceed to checkout.");
        window.location.href = "login.html";
        return;
    }

    showToast("Proceeding to checkout...");

    try {
        const response = await fetch(`${API_BASE_URL}/checkout`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ items: JSON.parse(localStorage.getItem("cart")) || [] }),
        });

        const data = await response.json();
        if (!data.success) throw new Error(data.message || "Checkout failed");

        // Initialize Razorpay payment
        const options = {
            key: "YOUR_RAZORPAY_KEY",
            amount: data.amount * 100, // Convert to paise
            currency: "INR",
            name: "MedSupply",
            description: "Order Payment",
            order_id: data.orderId,
            handler: function (response) {
                showToast("Payment Successful! Redirecting...");
                window.location.href = "order-success.html";
            },
            prefill: {
                name: data.user.name,
                email: data.user.email,
            },
            theme: {
                color: "#007BFF",
            },
        };

        const rzp = new Razorpay(options);
        rzp.open();
    } catch (error) {
        console.error("Checkout error:", error);
        showToast("Checkout failed! Try again.");
    }
}