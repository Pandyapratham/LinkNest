
require("dotenv").config({ quiet: true });

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const mongoose = require("mongoose");
const { rateLimit } = require("express-rate-limit");
const { requireAuth } = require("./middleware/requireAuth");

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI?.trim();
const configuredOrigins = (process.env.CLIENT_ORIGINS || process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = new Set(configuredOrigins);

if (process.env.NODE_ENV !== "production") {
  allowedOrigins.add("http://localhost:5173");
  allowedOrigins.add("http://127.0.0.1:5173");
  // Vite uses the next free port (commonly 5174) when 5173 is already occupied.
  allowedOrigins.add("http://localhost:5174");
  allowedOrigins.add("http://127.0.0.1:5174");
}

app.use(helmet());

app.use(cors({
  credentials: true,
  origin(origin, callback) {
    // Requests without an Origin header (for example, curl and server-to-server
    // requests) are allowed. Browser origins must match the explicit allowlist.
    callback(null, !origin || allowedOrigins.has(origin));
  },
}));

app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "Too many authentication requests. Please try again later." },
});
const publicClickRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "Too many link requests. Please try again shortly." },
});

app.get("/", (req, res) => {
  res.send("LinkNest backend is running!");
});

app.get("/api/health", (req, res) => {
  const connectionState = mongoose.connection.readyState;
  const databaseConnected = connectionState === 1;
  const databaseStatus = !MONGODB_URI
    ? "not_configured"
    : ( ["disconnected", "connected", "connecting", "disconnecting"][connectionState] || "unknown" );

  res.json({
    success: true,
    message: "LinkNest API is working",
    // Keep the original fields and values for existing health-check clients.
    database: databaseConnected ? "connected" : "not connected",
    application: "ok",
    status: databaseConnected ? "healthy" : (MONGODB_URI ? "degraded" : "not_configured"),
    databaseStatus,
  });
});

app.use("/api/auth", authRateLimit, require("./routes/auth"));
app.use("/api/profile", requireAuth, require("./routes/profiles"), require("./routes/links"), require("./routes/xml"));
app.use("/api/analytics", requireAuth, require("./routes/analytics"));
app.use("/api/lab", require("./routes/lab"));
app.use("/api/public/profiles", require("./routes/publicProfiles"));
app.use("/api/redirect", publicClickRateLimit, require("./routes/redirect"));

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error.type === "entity.too.large") {
    return res.status(413).json({ success: false, message: "Request body is too large" });
  }

  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return res.status(400).json({ success: false, message: "Invalid JSON request body" });
  }

  console.error("Unhandled request error.");
  return res.status(500).json({ success: false, message: "Internal server error" });
});

async function startServer() {
  try {
    if (MONGODB_URI) {
      await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
      console.log("MongoDB connected successfully!");
    } else {
      console.log("MongoDB URI not configured; database features are unavailable.");
    }

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch {
    // Driver errors may include connection details. Never print the URI or the
    // raw error message, which can contain host or credential information.
    console.error("MongoDB connection failed. Check MONGODB_URI, Atlas network access, and database user permissions.");
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
