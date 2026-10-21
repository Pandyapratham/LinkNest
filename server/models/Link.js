const mongoose = require("mongoose");
const { normalizeHttpUrl } = require("../utils/validation");

const PLATFORMS = ["website", "instagram", "tiktok", "youtube", "x", "linkedin", "github", "spotify", "facebook", "other"];

const linkSchema = new mongoose.Schema({
  profile: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Profile",
    required: true,
    index: true,
  },
  title: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
  destinationUrl: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2048,
    validate: { validator: (value) => Boolean(normalizeHttpUrl(value)), message: "Destination URL must use HTTP or HTTPS" },
  },
  description: { type: String, trim: true, maxlength: 280, default: "" },
  icon: { type: String, trim: true, maxlength: 50, default: "" },
  platform: { type: String, enum: PLATFORMS, default: "website" },
  displayOrder: { type: Number, min: 0, max: 10000, default: 0 },
  enabled: { type: Boolean, default: true },
}, { timestamps: true });

linkSchema.index({ profile: 1, displayOrder: 1, createdAt: 1 });

module.exports = mongoose.models.Link || mongoose.model("Link", linkSchema);
