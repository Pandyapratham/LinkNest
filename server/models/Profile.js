const mongoose = require("mongoose");
const { normalizeHttpUrl } = require("../utils/validation");

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
const THEMES = ["soft", "minimal", "gradient", "dark", "light", "midnight", "sunset"];
const LAYOUTS = ["classic", "grid", "portfolio"];
const FONT_FAMILIES = ["system", "serif", "mono"];
const BUTTON_STYLES = ["rounded", "pill", "square"];
const HEX_COLOR_PATTERN = /^#[\da-f]{6}$/i;
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
  backgroundColor: { type: String, match: HEX_COLOR_PATTERN, default: "#fbf9ff" },
  accentColor: { type: String, match: HEX_COLOR_PATTERN, default: "#8062e6" },
  fontFamily: { type: String, enum: FONT_FAMILIES, default: "system" },
  buttonStyle: { type: String, enum: BUTTON_STYLES, default: "rounded" },
  layout: { type: String, enum: LAYOUTS, default: "classic" },
  bannerUrl: {
    type: String,
    trim: true,
    maxlength: 2048,
    default: "",
    validate: { validator: (value) => value === "" || Boolean(normalizeHttpUrl(value)), message: "Banner URL must use HTTP or HTTPS" },
  },
  socialLinks: { type: [socialLinkSchema], default: [], validate: [(links) => links.length <= 8, "At most 8 social links are allowed"] },
  enabled: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.models.Profile || mongoose.model("Profile", profileSchema);
