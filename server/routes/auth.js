const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { COOKIE_NAME, getJwtSecret, publicUser, requireAuth } = require("../middleware/requireAuth");

const router = express.Router();
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

function setSessionCookie(res, userId, secret) {
  const token = jwt.sign({}, secret, {
    subject: String(userId),
    issuer: "linknest-api",
    audience: "linknest-client",
    expiresIn: "7d",
  });

  res.cookie(COOKIE_NAME, token, {
    ...cookieOptions(),
    maxAge: SESSION_MAX_AGE_MS,
  });
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function containsOnlyKeys(value, allowedKeys) {
  return Object.keys(value).every((key) => allowedKeys.includes(key));
}

function validateEmail(rawEmail) {
  if (typeof rawEmail !== "string") return null;
  const email = rawEmail.trim().toLowerCase();
  return email.length <= 254 && EMAIL_PATTERN.test(email) ? email : null;
}

function validatePassword(password) {
  return typeof password === "string"
    && Buffer.byteLength(password, "utf8") >= 8
    && Buffer.byteLength(password, "utf8") <= 72;
}

function unavailableWithoutJwtSecret(res) {
  if (getJwtSecret()) return false;
  res.status(503).json({ success: false, message: "Authentication is not configured" });
  return true;
}

function handleDatabaseError(res, error) {
  if (error?.code === 11000) {
    return res.status(409).json({ success: false, message: "Email or username is already in use" });
  }

  if (error?.name === "ValidationError" || error?.name === "CastError") {
    return res.status(400).json({ success: false, message: "Invalid account details" });
  }

  // Do not log raw database errors; they may include connection details.
  console.error("Authentication request failed.");
  return res.status(500).json({ success: false, message: "Unable to complete authentication request" });
}

router.post("/register", async (req, res) => {
  if (unavailableWithoutJwtSecret(res)) return;
  if (!isPlainObject(req.body) || !containsOnlyKeys(req.body, ["email", "username", "password"])) {
    return res.status(400).json({ success: false, message: "Provide only email, username, and password" });
  }

  const email = validateEmail(req.body.email);
  const username = typeof req.body.username === "string" ? req.body.username.trim().toLowerCase() : "";
  const password = req.body.password;

  if (!email) {
    return res.status(400).json({ success: false, message: "Enter a valid email address" });
  }
  if (!USERNAME_PATTERN.test(username)) {
    return res.status(400).json({ success: false, message: "Username must be 3–24 characters using letters, numbers, or underscores" });
  }
  if (!validatePassword(password)) {
    return res.status(400).json({ success: false, message: "Password must be 8–72 bytes" });
  }

  try {
    const duplicate = await User.exists({ $or: [{ email }, { username }] });
    if (duplicate) {
      return res.status(409).json({ success: false, message: "Email or username is already in use" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ email, username, passwordHash });
    setSessionCookie(res, user._id, getJwtSecret());
    return res.status(201).json({ success: true, user: publicUser(user) });
  } catch (error) {
    return handleDatabaseError(res, error);
  }
});

router.post("/login", async (req, res) => {
  if (unavailableWithoutJwtSecret(res)) return;
  if (!isPlainObject(req.body) || !containsOnlyKeys(req.body, ["email", "password"])) {
    return res.status(400).json({ success: false, message: "Provide only email and password" });
  }

  const email = validateEmail(req.body.email);
  const password = req.body.password;
  if (!email || !validatePassword(password)) {
    return res.status(400).json({ success: false, message: "Enter a valid email address and password" });
  }

  try {
    const user = await User.findOne({ email }).select("+passwordHash");
    const passwordMatches = user
      ? await bcrypt.compare(password, user.passwordHash)
      : false;

    if (!passwordMatches) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    setSessionCookie(res, user._id, getJwtSecret());
    return res.json({ success: true, user: publicUser(user) });
  } catch (error) {
    return handleDatabaseError(res, error);
  }
});

router.post("/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME, cookieOptions());
  return res.json({ success: true, message: "Logged out successfully" });
});

router.get("/me", requireAuth, (req, res) => {
  return res.json({ success: true, user: publicUser(req.user) });
});

module.exports = router;
