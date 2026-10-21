require("dotenv").config({ quiet: true });

const assert = require("node:assert/strict");
const { randomBytes, randomUUID } = require("node:crypto");
const { after, before, test } = require("node:test");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

// Use a disposable process-only key so tests do not depend on or reveal the
// developer's configured JWT secret.
process.env.JWT_SECRET = randomBytes(48).toString("hex");

const User = require("../models/User");
const { app } = require("../server");

const testId = randomUUID().replaceAll("-", "");
const testEmail = `linknest-${testId}@example.invalid`;
const testUsername = `ln${testId.slice(0, 18)}`;
const testPassword = "test-only-passphrase-2026";

let httpServer;
let baseUrl;

before(async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error("Set MONGODB_URI in server/.env before running the auth integration tests.");
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    await User.init();
  } catch {
    throw new Error("Could not connect to MongoDB or prepare the User indexes for auth integration tests.");
  }
  httpServer = app.listen(0);
  await new Promise((resolve, reject) => {
    httpServer.once("listening", resolve);
    httpServer.once("error", reject);
  });
  baseUrl = `http://127.0.0.1:${httpServer.address().port}`;
});

after(async () => {
  // Only remove the uniquely generated account created by this test run.
  if (mongoose.connection.readyState === 1) {
    await User.deleteOne({ email: testEmail });
  }
  if (httpServer?.listening) {
    await new Promise((resolve, reject) => {
      httpServer.close((error) => error ? reject(error) : resolve());
    });
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});

async function request(path, { method = "GET", body, cookie, origin } = {}) {
  const headers = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (cookie) headers.cookie = cookie;
  if (origin) headers.origin = origin;
  return fetch(`${baseUrl}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

async function json(response) {
  return response.json();
}

test("authentication endpoints validate input and manage an HttpOnly session", async (t) => {
  await t.test("preserves the health endpoint and reports the live database state", async () => {
    const response = await request("/api/health");
    const result = await json(response);
    assert.equal(response.status, 200);
    assert.equal(result.success, true);
    assert.equal(result.database, "connected");
    assert.equal(result.databaseStatus, "connected");
  });

  await t.test("rejects invalid registration input", async () => {
    const response = await request("/api/auth/register", {
      method: "POST",
      body: { email: "not-an-email", username: "x", password: "short" },
    });
    assert.equal(response.status, 400);
  });

  let registrationCookie;
  await t.test("registers a normalized account and sets an HttpOnly Lax cookie", async () => {
    const response = await request("/api/auth/register", {
      method: "POST",
      body: {
        email: `  ${testEmail.toUpperCase()}  `,
        username: `  ${testUsername.toUpperCase()}  `,
        password: testPassword,
      },
    });
    const result = await json(response);
    const setCookie = response.headers.get("set-cookie") || "";

    assert.equal(response.status, 201);
    assert.equal(result.user.email, testEmail);
    assert.equal(result.user.username, testUsername);
    assert.equal("password" in result.user, false);
    assert.equal("passwordHash" in result.user, false);
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Lax/i);
    assert.match(setCookie, /Max-Age=604800/i);
    const storedUser = await User.findOne({ email: testEmail }).select("+passwordHash");
    assert.notEqual(storedUser.passwordHash, testPassword);
    assert.equal(await bcrypt.compare(testPassword, storedUser.passwordHash), true);
    registrationCookie = setCookie.split(";")[0];
  });

  await t.test("rejects duplicate email and duplicate username", async () => {
    const duplicateEmail = await request("/api/auth/register", {
      method: "POST",
      body: { email: ` ${testEmail.toUpperCase()} `, username: `${testUsername}x`, password: testPassword },
    });
    const duplicateUsername = await request("/api/auth/register", {
      method: "POST",
      body: { email: `other-${testId}@example.invalid`, username: testUsername, password: testPassword },
    });
    assert.equal(duplicateEmail.status, 409);
    assert.equal(duplicateUsername.status, 409);
  });

  await t.test("logs in with normalized email and rejects wrong credentials", async () => {
    const response = await request("/api/auth/login", {
      method: "POST",
      body: { email: ` ${testEmail.toUpperCase()} `, password: testPassword },
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("set-cookie") || "", /HttpOnly/i);
    assert.equal("passwordHash" in (await json(response)).user, false);

    const wrongPassword = await request("/api/auth/login", {
      method: "POST",
      body: { email: testEmail, password: "incorrect-password" },
    });
    assert.equal(wrongPassword.status, 401);
  });

  await t.test("logs in by normalized username and rejects unknown identifiers", async () => {
    const response = await request("/api/auth/login", {
      method: "POST",
      body: { identifier: ` ${testUsername.toUpperCase()} `, password: testPassword },
    });
    assert.equal(response.status, 200);
    const setCookie = response.headers.get("set-cookie") || "";
    assert.match(setCookie, /HttpOnly/i);
    const cookie = setCookie.split(";")[0];

    const session = await request("/api/auth/me", { cookie });
    const sessionResult = await json(session);
    assert.equal(session.status, 200);
    assert.equal(sessionResult.user.username, testUsername);

    const unknownUsername = await request("/api/auth/login", {
      method: "POST",
      body: { identifier: `missing${testId.slice(0, 12)}`, password: testPassword },
    });
    const unknownEmail = await request("/api/auth/login", {
      method: "POST",
      body: { identifier: `missing-${testId}@example.invalid`, password: testPassword },
    });
    assert.equal(unknownUsername.status, 401);
    assert.equal(unknownEmail.status, 401);
  });

  await t.test("keeps the Vite 5174 origin credential-enabled", async () => {
    const response = await request("/api/auth/login", {
      method: "POST",
      body: { identifier: testUsername, password: testPassword },
      origin: "http://localhost:5174",
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:5174");
    assert.equal(response.headers.get("access-control-allow-credentials"), "true");
    assert.match(response.headers.get("set-cookie") || "", /HttpOnly/i);
  });

  await t.test("marks the authentication cookie Secure in production", async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const response = await request("/api/auth/login", {
        method: "POST",
        body: { email: testEmail, password: testPassword },
      });
      assert.equal(response.status, 200);
      assert.match(response.headers.get("set-cookie") || "", /Secure/i);
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
    }
  });

  await t.test("/me requires a valid cookie and returns only public user fields", async () => {
    const loggedOut = await request("/api/auth/me");
    assert.equal(loggedOut.status, 401);

    const loggedIn = await request("/api/auth/me", { cookie: registrationCookie });
    const result = await json(loggedIn);
    assert.equal(loggedIn.status, 200);
    assert.equal(result.user.email, testEmail);
    assert.equal("passwordHash" in result.user, false);
  });

  await t.test("logout clears the cookie and the old session is rejected", async () => {
    const logout = await request("/api/auth/logout", { method: "POST", cookie: registrationCookie });
    assert.equal(logout.status, 200);
    assert.match(logout.headers.get("set-cookie") || "", /Expires=Thu, 01 Jan 1970/i);

    const loggedOut = await request("/api/auth/me");
    assert.equal(loggedOut.status, 401);
  });
});
