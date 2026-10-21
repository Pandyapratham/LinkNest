require("dotenv").config({ quiet: true });

const assert = require("node:assert/strict");
const { randomBytes, randomUUID } = require("node:crypto");
const { after, before, test } = require("node:test");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const testSecret = randomBytes(48).toString("hex");
process.env.JWT_SECRET = testSecret;

const Link = require("../models/Link");
const Profile = require("../models/Profile");
const User = require("../models/User");
const { app } = require("../server");

const runId = randomUUID().replaceAll("-", "");
const users = [];
let httpServer;
let baseUrl;
let firstCookie;
let secondCookie;
let firstProfile;
let secondProfile;
let links = {};

before(async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error("Set MONGODB_URI in server/.env before running the profile and link integration tests.");
  }
  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    await Promise.all([User.init(), Profile.init(), Link.init()]);

    const passwordHash = await bcrypt.hash(randomBytes(24).toString("hex"), 4);
    const [firstUser, secondUser] = await User.create([
      { email: `phase3-a-${runId}@example.invalid`, username: `p3a${runId.slice(0, 18)}`, passwordHash },
      { email: `phase3-b-${runId}@example.invalid`, username: `p3b${runId.slice(0, 18)}`, passwordHash },
    ]);
    users.push(firstUser._id, secondUser._id);
    firstCookie = createCookie(firstUser._id);
    secondCookie = createCookie(secondUser._id);
  } catch {
    throw new Error("Could not connect to MongoDB or prepare unique test accounts for profile and link tests.");
  }

  httpServer = app.listen(0);
  await new Promise((resolve, reject) => {
    httpServer.once("listening", resolve);
    httpServer.once("error", reject);
  });
  baseUrl = `http://127.0.0.1:${httpServer.address().port}`;
});

after(async () => {
  try {
    if (mongoose.connection.readyState === 1 && users.length) {
      const ownedProfiles = await Profile.find({ owner: { $in: users } }).select("_id").lean();
      const profileIds = ownedProfiles.map((profile) => profile._id);
      if (profileIds.length) await Link.deleteMany({ profile: { $in: profileIds } });
      await Profile.deleteMany({ owner: { $in: users } });
      await User.deleteMany({ _id: { $in: users } });
    }
  } catch {
    throw new Error("Could not clean up uniquely generated profile and link test data.");
  } finally {
    if (httpServer?.listening) {
      await new Promise((resolve, reject) => {
        httpServer.close((error) => error ? reject(error) : resolve());
      });
    }
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  }
});

function createCookie(userId) {
  const token = jwt.sign({}, testSecret, {
    subject: String(userId),
    issuer: "linknest-api",
    audience: "linknest-client",
    expiresIn: "30m",
  });
  return `linknest_token=${token}`;
}

async function request(path, { method = "GET", body, cookie } = {}) {
  const headers = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (cookie) headers.cookie = cookie;
  return fetch(`${baseUrl}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

async function readJson(response) {
  return response.json();
}

test("profile and link APIs validate data and enforce ownership", async (t) => {
  await t.test("rejects unauthenticated profile and link requests", async () => {
    const profileResponse = await request("/api/profile/me");
    const linkResponse = await request("/api/profile/me/links", { method: "POST", body: {} });
    assert.equal(profileResponse.status, 401);
    assert.equal(linkResponse.status, 401);
  });

  await t.test("validates slugs and creates one normalized profile per user", async () => {
    const invalidSlug = await request("/api/profile", {
      method: "POST",
      cookie: firstCookie,
      body: { slug: "Not A Slug", displayName: "Taylor" },
    });
    assert.equal(invalidSlug.status, 400);

    const createResponse = await request("/api/profile", {
      method: "POST",
      cookie: firstCookie,
      body: {
        slug: `  creator-${runId.slice(0, 10)}  `,
        displayName: "  Taylor Creator  ",
        bio: "Designer and maker",
        avatarUrl: "https://images.example.invalid/taylor.png",
        theme: "sunset",
        socialLinks: [{ platform: "instagram", url: "https://instagram.com/taylor", label: "Instagram" }],
      },
    });
    const result = await readJson(createResponse);
    assert.equal(createResponse.status, 201);
    assert.equal(result.profile.displayName, "Taylor Creator");
    assert.equal(result.profile.slug, `creator-${runId.slice(0, 10)}`);
    assert.equal("owner" in result.profile, false);
    firstProfile = result.profile;

    const duplicateForOwner = await request("/api/profile", {
      method: "POST",
      cookie: firstCookie,
      body: { slug: `another-${runId.slice(0, 10)}`, displayName: "Second page" },
    });
    assert.equal(duplicateForOwner.status, 409);

    const duplicateSlugForAnotherOwner = await request("/api/profile", {
      method: "POST",
      cookie: secondCookie,
      body: { slug: firstProfile.slug, displayName: "Different owner" },
    });
    assert.equal(duplicateSlugForAnotherOwner.status, 409);

    const otherProfileResponse = await request("/api/profile", {
      method: "POST",
      cookie: secondCookie,
      body: { slug: `other-${runId.slice(0, 10)}`, displayName: "Other owner" },
    });
    assert.equal(otherProfileResponse.status, 201);
    secondProfile = (await readJson(otherProfileResponse)).profile;
  });

  await t.test("retrieves and updates only the authenticated user's profile", async () => {
    const getResponse = await request("/api/profile/me", { cookie: firstCookie });
    assert.equal(getResponse.status, 200);
    assert.equal((await readJson(getResponse)).profile.id, firstProfile.id);

    const updateResponse = await request("/api/profile/me", {
      method: "PATCH",
      cookie: firstCookie,
      body: { bio: "Updated bio", theme: "dark" },
    });
    const result = await readJson(updateResponse);
    assert.equal(updateResponse.status, 200);
    assert.equal(result.profile.bio, "Updated bio");
    assert.equal(result.profile.theme, "dark");

    const forbiddenField = await request("/api/profile/me", {
      method: "PATCH",
      cookie: firstCookie,
      body: { owner: users[1] },
    });
    assert.equal(forbiddenField.status, 400);

    const otherUserProfile = await request(`/api/profile/me?profileId=${firstProfile.id}`, { cookie: secondCookie });
    const otherUserResult = await readJson(otherUserProfile);
    assert.equal(otherUserProfile.status, 200);
    assert.equal(otherUserResult.profile.id, secondProfile.id);
    assert.notEqual(otherUserResult.profile.id, firstProfile.id);
  });

  await t.test("rejects unsafe link URLs and creates links with ordered defaults", async () => {
    for (const destinationUrl of ["javascript:alert(1)", "data:text/html,<script>", "ftp://files.example.invalid/file"]) {
      const unsafe = await request("/api/profile/me/links", {
        method: "POST",
        cookie: firstCookie,
        body: { title: "Unsafe", destinationUrl },
      });
      assert.equal(unsafe.status, 400);
    }

    const first = await request("/api/profile/me/links", {
      method: "POST",
      cookie: firstCookie,
      body: { title: "Portfolio", destinationUrl: " https://portfolio.example.invalid/work ", platform: "website" },
    });
    const second = await request("/api/profile/me/links", {
      method: "POST",
      cookie: firstCookie,
      body: { title: "Instagram", destinationUrl: "https://instagram.com/taylor", platform: "instagram" },
    });
    const disabled = await request("/api/profile/me/links", {
      method: "POST",
      cookie: firstCookie,
      body: { title: "Hidden link", destinationUrl: "https://hidden.example.invalid", enabled: false },
    });
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.equal(disabled.status, 201);
    links = {
      first: (await readJson(first)).link,
      second: (await readJson(second)).link,
      disabled: (await readJson(disabled)).link,
    };
    assert.equal(links.first.displayOrder, 0);
    assert.equal(links.second.displayOrder, 1);
    assert.equal(links.disabled.enabled, false);
  });

  await t.test("lists, updates, reorders, and deletes only profile-owned links", async () => {
    const initialList = await request("/api/profile/me/links", { cookie: firstCookie });
    assert.deepEqual((await readJson(initialList)).links.map((link) => link.id), [links.first.id, links.second.id, links.disabled.id]);

    const invalidUpdate = await request(`/api/profile/me/links/${links.first.id}`, {
      method: "PATCH",
      cookie: firstCookie,
      body: { destinationUrl: "data:text/html,unsafe" },
    });
    assert.equal(invalidUpdate.status, 400);

    const update = await request(`/api/profile/me/links/${links.second.id}`, {
      method: "PATCH",
      cookie: firstCookie,
      body: { title: "My Instagram", description: "Follow along" },
    });
    assert.equal(update.status, 200);
    assert.equal((await readJson(update)).link.title, "My Instagram");

    const reorder = await request("/api/profile/me/links/reorder", {
      method: "PATCH",
      cookie: firstCookie,
      body: { linkIds: [links.disabled.id, links.first.id, links.second.id] },
    });
    const reorderedLinks = (await readJson(reorder)).links;
    assert.equal(reorder.status, 200);
    assert.deepEqual(reorderedLinks.map((link) => link.id), [links.disabled.id, links.first.id, links.second.id]);
    assert.deepEqual(reorderedLinks.map((link) => link.displayOrder), [0, 1, 2]);

    const otherUserUpdate = await request(`/api/profile/me/links/${links.first.id}`, {
      method: "PATCH",
      cookie: secondCookie,
      body: { title: "Attempted takeover" },
    });
    const otherUserDelete = await request(`/api/profile/me/links/${links.first.id}`, {
      method: "DELETE",
      cookie: secondCookie,
    });
    const otherUserReorder = await request("/api/profile/me/links/reorder", {
      method: "PATCH",
      cookie: secondCookie,
      body: { linkIds: [links.first.id] },
    });
    assert.equal(otherUserUpdate.status, 404);
    assert.equal(otherUserDelete.status, 404);
    assert.equal(otherUserReorder.status, 404);

    const deleteResponse = await request(`/api/profile/me/links/${links.second.id}`, {
      method: "DELETE",
      cookie: firstCookie,
    });
    assert.equal(deleteResponse.status, 204);
    links.second = null;
  });

  await t.test("public profile exposes only display fields and hides disabled content", async () => {
    const response = await request(`/api/public/profiles/${firstProfile.slug}`);
    const result = await readJson(response);
    assert.equal(response.status, 200);
    assert.deepEqual(Object.keys(result.profile).sort(), ["avatarUrl", "bio", "displayName", "links", "slug", "socialLinks", "theme"].sort());
    assert.equal("owner" in result.profile, false);
    assert.equal("email" in result.profile, false);
    assert.equal("userId" in result.profile, false);
    assert.equal(result.profile.links.some((link) => link.title === "Hidden link"), false);
    assert.equal(result.profile.links.some((link) => link._id || link.profile), false);

    const disabledProfile = await request("/api/profile/me", {
      method: "PATCH",
      cookie: firstCookie,
      body: { enabled: false },
    });
    assert.equal(disabledProfile.status, 200);
    const hiddenProfile = await request(`/api/public/profiles/${firstProfile.slug}`);
    assert.equal(hiddenProfile.status, 404);
  });

  await t.test("deletes the authenticated user's profile and its links", async () => {
    const deleteResponse = await request("/api/profile/me", { method: "DELETE", cookie: firstCookie });
    assert.equal(deleteResponse.status, 204);

    const missingProfile = await request("/api/profile/me", { cookie: firstCookie });
    const missingLinks = await request("/api/profile/me/links", { cookie: firstCookie });
    assert.equal(missingProfile.status, 404);
    assert.equal(missingLinks.status, 404);
    assert.equal(await Link.countDocuments({ profile: firstProfile.id }), 0);
  });
});
