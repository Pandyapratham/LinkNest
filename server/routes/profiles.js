const express = require("express");
const mongoose = require("mongoose");
const Link = require("../models/Link");
const ClickEvent = require("../models/ClickEvent");
const Profile = require("../models/Profile");
const { hasOnlyKeys, isPlainObject, normalizeHttpUrl, normalizeSlug } = require("../utils/validation");

const router = express.Router();
const PROFILE_KEYS = ["slug", "displayName", "bio", "avatarUrl", "theme", "backgroundColor", "accentColor", "fontFamily", "buttonStyle", "layout", "bannerUrl", "socialLinks", "enabled"];
const THEMES = ["soft", "minimal", "gradient", "dark", "light", "midnight", "sunset"];
const LAYOUTS = ["classic", "grid", "portfolio"];
const FONT_FAMILIES = ["system", "serif", "mono"];
const BUTTON_STYLES = ["rounded", "pill", "square"];
const HEX_COLOR_PATTERN = /^#[\da-f]{6}$/i;
const SOCIAL_PLATFORMS = ["instagram", "tiktok", "youtube", "x", "linkedin", "github", "facebook", "website"];

function profileJson(profile) {
  return {
    id: String(profile._id),
    slug: profile.slug,
    displayName: profile.displayName,
    bio: profile.bio,
    avatarUrl: profile.avatarUrl,
    theme: profile.theme,
    backgroundColor: profile.backgroundColor || "#fbf9ff",
    accentColor: profile.accentColor || "#8062e6",
    fontFamily: profile.fontFamily || "system",
    buttonStyle: profile.buttonStyle || "rounded",
    layout: profile.layout || "classic",
    bannerUrl: profile.bannerUrl || "",
    socialLinks: profile.socialLinks.map((item) => ({ platform: item.platform, url: item.url, label: item.label })),
    enabled: profile.enabled,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

function normalizeSocialLinks(value) {
  if (!Array.isArray(value) || value.length > 8) return { error: "Provide up to 8 social links" };
  const seenPlatforms = new Set();
  const socialLinks = [];

  for (const item of value) {
    if (!hasOnlyKeys(item, ["platform", "url", "label"])) return { error: "Invalid social link" };
    const platform = typeof item.platform === "string" ? item.platform.trim().toLowerCase() : "";
    const url = normalizeHttpUrl(item.url);
    const label = item.label === undefined ? "" : item.label;

    if (!SOCIAL_PLATFORMS.includes(platform) || !url) return { error: "Social links must use a supported platform and HTTP or HTTPS URL" };
    if (typeof label !== "string" || label.trim().length > 30) return { error: "Social link labels must be 30 characters or fewer" };
    if (seenPlatforms.has(platform)) return { error: "Each social platform can appear only once" };

    seenPlatforms.add(platform);
    socialLinks.push({ platform, url, label: label.trim() });
  }

  return { value: socialLinks };
}

function normalizeProfileBody(body, isCreate) {
  if (!hasOnlyKeys(body, PROFILE_KEYS)) return { error: "Invalid profile fields" };
  if (Object.keys(body).length === 0) return { error: "Provide at least one profile field" };

  const value = {};
  if (body.slug !== undefined) {
    value.slug = normalizeSlug(body.slug);
    if (!value.slug) return { error: "Slug must be 3–40 URL-safe letters, numbers, or hyphens" };
  }
  if (body.displayName !== undefined) {
    if (typeof body.displayName !== "string" || !body.displayName.trim() || body.displayName.trim().length > 80) {
      return { error: "Display name is required and must be 80 characters or fewer" };
    }
    value.displayName = body.displayName.trim();
  }
  if (body.bio !== undefined) {
    if (typeof body.bio !== "string" || body.bio.trim().length > 280) return { error: "Bio must be 280 characters or fewer" };
    value.bio = body.bio.trim();
  }
  if (body.avatarUrl !== undefined) {
    const avatarUrl = normalizeHttpUrl(body.avatarUrl, { allowEmpty: true });
    if (avatarUrl === null) return { error: "Avatar URL must be empty or use HTTP or HTTPS" };
    value.avatarUrl = avatarUrl;
  }
  if (body.theme !== undefined) {
    if (typeof body.theme !== "string" || !THEMES.includes(body.theme)) return { error: "Unsupported profile theme" };
    value.theme = body.theme;
  }
  for (const key of ["backgroundColor", "accentColor"]) {
    if (body[key] !== undefined) {
      if (typeof body[key] !== "string" || !HEX_COLOR_PATTERN.test(body[key])) return { error: `${key === "backgroundColor" ? "Background" : "Accent"} color must be a six-digit hex color` };
      value[key] = body[key].toLowerCase();
    }
  }
  if (body.fontFamily !== undefined) {
    if (typeof body.fontFamily !== "string" || !FONT_FAMILIES.includes(body.fontFamily)) return { error: "Unsupported profile font" };
    value.fontFamily = body.fontFamily;
  }
  if (body.buttonStyle !== undefined) {
    if (typeof body.buttonStyle !== "string" || !BUTTON_STYLES.includes(body.buttonStyle)) return { error: "Unsupported link button style" };
    value.buttonStyle = body.buttonStyle;
  }
  if (body.layout !== undefined) {
    if (typeof body.layout !== "string" || !LAYOUTS.includes(body.layout)) return { error: "Unsupported profile layout" };
    value.layout = body.layout;
  }
  if (body.bannerUrl !== undefined) {
    const bannerUrl = normalizeHttpUrl(body.bannerUrl, { allowEmpty: true });
    if (bannerUrl === null) return { error: "Banner URL must be empty or use HTTP or HTTPS" };
    value.bannerUrl = bannerUrl;
  }
  if (body.socialLinks !== undefined) {
    const result = normalizeSocialLinks(body.socialLinks);
    if (result.error) return result;
    value.socialLinks = result.value;
  }
  if (body.enabled !== undefined) {
    if (typeof body.enabled !== "boolean") return { error: "Enabled must be a boolean" };
    value.enabled = body.enabled;
  }

  if (isCreate && (!value.slug || !value.displayName)) {
    return { error: "Slug and display name are required" };
  }
  return { value };
}

function handleProfileError(res, error) {
  if (error?.code === 11000) {
    if (error.keyPattern?.owner) {
      return res.status(409).json({ success: false, message: "This account already has a profile" });
    }
    return res.status(409).json({ success: false, message: "This profile slug is already taken" });
  }
  if (error?.name === "ValidationError" || error?.name === "CastError") {
    return res.status(400).json({ success: false, message: "Invalid profile details" });
  }
  console.error("Profile request failed.");
  return res.status(500).json({ success: false, message: "Unable to complete profile request" });
}

router.post("/", async (req, res) => {
  const normalized = normalizeProfileBody(req.body, true);
  if (normalized.error) return res.status(400).json({ success: false, message: normalized.error });

  try {
    const profile = await Profile.create({ ...normalized.value, owner: req.user._id });
    return res.status(201).json({ success: true, profile: profileJson(profile) });
  } catch (error) {
    return handleProfileError(res, error);
  }
});

router.get("/me", async (req, res) => {
  try {
    const profile = await Profile.findOne({ owner: req.user._id });
    if (!profile) return res.status(404).json({ success: false, message: "Profile not found" });
    return res.json({ success: true, profile: profileJson(profile) });
  } catch (error) {
    return handleProfileError(res, error);
  }
});

router.patch("/me", async (req, res) => {
  const normalized = normalizeProfileBody(req.body, false);
  if (normalized.error) return res.status(400).json({ success: false, message: normalized.error });

  try {
    const profile = await Profile.findOne({ owner: req.user._id });
    if (!profile) return res.status(404).json({ success: false, message: "Profile not found" });
    Object.assign(profile, normalized.value);
    await profile.save();
    return res.json({ success: true, profile: profileJson(profile) });
  } catch (error) {
    return handleProfileError(res, error);
  }
});

router.delete("/me", async (req, res) => {
  const session = await mongoose.startSession();
  let found = false;
  try {
    await session.withTransaction(async () => {
      const profile = await Profile.findOne({ owner: req.user._id }).session(session);
      if (!profile) return;
      found = true;
      await Link.deleteMany({ profile: profile._id }).session(session);
      await ClickEvent.deleteMany({ profile: profile._id }).session(session);
      await Profile.deleteOne({ _id: profile._id, owner: req.user._id }).session(session);
    });
    if (!found) return res.status(404).json({ success: false, message: "Profile not found" });
    return res.status(204).end();
  } catch (error) {
    return handleProfileError(res, error);
  } finally {
    await session.endSession();
  }
});

module.exports = router;
