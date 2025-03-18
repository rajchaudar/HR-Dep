const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String },
    price: { type: Number, required: true },
    marketer: { type: String }, // Who markets the product
    marketed: { type: Boolean, default: false }, // If the product is marketed
    availableForSale: { type: Boolean, default: false }, // If available in the store
    image: { type: String, default: "" } // ✅ Add this line
});

module.exports = mongoose.model("Product", productSchema);