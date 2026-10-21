const jwt = require("jsonwebtoken");
const User = require("../models/User");

const COOKIE_NAME = "linknest_token";

function getJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim();
  return secret && Buffer.byteLength(secret, "utf8") >= 32 ? secret : null;
}

function publicUser(user) {
  return {
    id: String(user._id),
    email: user.email,
    username: user.username,
    createdAt: user.createdAt,
  };
}

async function requireAuth(req, res, next) {
  const secret = getJwtSecret();
  if (!secret) {
    return res.status(503).json({ success: false, message: "Authentication is not configured" });
  }

  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }

  try {
    const payload = jwt.verify(token, secret, {
      issuer: "linknest-api",
      audience: "linknest-client",
    });

    if (typeof payload.sub !== "string") {
      return res.status(401).json({ success: false, message: "Invalid or expired session" });
    }

    const user = await User.findById(payload.sub);
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid or expired session" });
    }

    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired session" });
  }
}

module.exports = { COOKIE_NAME, getJwtSecret, publicUser, requireAuth };
