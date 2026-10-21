const mongoose = require("mongoose");
const { normalizeHttpUrl } = require("../utils/validation");

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
const THEMES = ["soft", "light", "dark", "midnight", "sunset"];
const SOCIAL_PLATFORMS = ["instagram", "tiktok", "youtube", "x", "linkedin", "github", "facebook", "website"];

const socialLinkSchema = new mongoose.Schema({
  platform: { type: String, required: true, enum: SOCIAL_PLATFORMS },
  url: {
    type: String,
    required: true,
    maxlength: 2048,
    validate: { validator: (value) => Boolean(normalizeHttpUrl(value)), message: "Social links must use HTTP or HTTPS" },
  },
  label: { type: String, trim: true, maxlength: 30, default: "" },
}, { _id: false });

const profileSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  slug: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    minlength: 3,
    maxlength: 40,
    match: SLUG_PATTERN,
    unique: true,
  },
  displayName: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
  bio: { type: String, trim: true, maxlength: 280, default: "" },
  avatarUrl: {
    type: String,
    trim: true,
    maxlength: 2048,
    default: "",
    validate: { validator: (value) => value === "" || Boolean(normalizeHttpUrl(value)), message: "Avatar URL must use HTTP or HTTPS" },
  },
  theme: { type: String, enum: THEMES, default: "soft" },
  socialLinks: { type: [socialLinkSchema], default: [], validate: [(links) => links.length <= 8, "At most 8 social links are allowed"] },
  enabled: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.models.Profile || mongoose.model("Profile", profileSchema);
