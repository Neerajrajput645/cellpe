const { Schema, model } = require("mongoose");

// Affiliate
const affiliateSchema = new Schema(
  {
    name: { type: String, required: true },
    link: { type: String, required: true },
    image: { type: String, required: true },
    status: { type: Boolean, default: true },
    description: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = model("Affiliate", affiliateSchema);
