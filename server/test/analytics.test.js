require("dotenv").config({ quiet: true });

const assert = require("node:assert/strict");
const { randomBytes, randomUUID } = require("node:crypto");
const { after, before, test } = require("node:test");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Profile = require("../models/Profile");
const Link = require("../models/Link");
const ClickEvent = require("../models/ClickEvent");
const { profileToXml } = require("../utils/linknestXml");

const secret = randomBytes(48).toString("hex");
process.env.JWT_SECRET = secret;
const runId = randomUUID().replaceAll("-", "");
const users = [];
let server;
let baseUrl;
let profile;
let link;
let cookie;
let secondCookie;

function signedCookie(userId) {
  const token = jwt.sign({}, secret, { subject: String(userId), issuer: "linknest-api", audience: "linknest-client", expiresIn: "30m" });
  return `linknest_token=${token}`;
}

async function request(path, options = {}) {
  const headers = { ...(options.cookie ? { cookie: options.cookie } : {}), ...(options.headers || {}) };
  return fetch(`${baseUrl}${path}`, { ...options, headers, redirect: "manual" });
}

before(async () => {
  if (!process.env.MONGODB_URI) throw new Error("Set MONGODB_URI before running the analytics integration tests.");
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  await Promise.all([User.init(), Profile.init(), Link.init(), ClickEvent.init()]);
  const createdUsers = await User.create([
    { email: `analytics-a-${runId}@example.invalid`, username: `ana${runId.slice(0, 18)}`, passwordHash: "test-only-hash" },
    { email: `analytics-b-${runId}@example.invalid`, username: `anb${runId.slice(0, 18)}`, passwordHash: "test-only-hash" },
  ]);
  users.push(...createdUsers.map(item => item._id));
  cookie = signedCookie(users[0]);
  secondCookie = signedCookie(users[1]);
  [profile] = await Profile.create([{ owner: users[0], slug: `analytics-${runId.slice(0, 10)}`, displayName: "Analytics test" }]);
  await Profile.create({ owner: users[1], slug: `analytics-other-${runId.slice(0, 8)}`, displayName: "Other account" });
  [link] = await Link.create([{ profile: profile._id, title: "Safe destination", destinationUrl: "https://example.com/path", displayOrder: 0 }]);
  server = require("../server").app.listen(0);
  await new Promise((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  try {
    if (mongoose.connection.readyState === 1 && users.length) {
      const profiles = await Profile.find({ owner: { $in: users } }).select("_id").lean();
      const profileIds = profiles.map(item => item._id);
      if (profileIds.length) {
        await ClickEvent.deleteMany({ profile: { $in: profileIds } });
        await Link.deleteMany({ profile: { $in: profileIds } });
        await Profile.deleteMany({ _id: { $in: profileIds } });
      }
      await User.deleteMany({ _id: { $in: users } });
    }
  } finally {
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  }
});

test("public redirect records privacy-minimized clicks and analytics stays owner-scoped", async (t) => {
  await t.test("redirects only to the validated destination and stores coarse metadata", async () => {
    const response = await request(`/api/redirect/${profile.slug}/${link._id}`, { headers: { "user-agent": "Mozilla/5.0 (iPhone; Mobile)", referer: "https://social.example/post/secret-path" } });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), "https://example.com/path");
    const event = await ClickEvent.findOne({ profile: profile._id, link: link._id }).lean();
    assert.equal(event.deviceType, "mobile");
    assert.equal(event.referrerDomain, "social.example");
    assert.equal("ip" in event, false);
    assert.equal("userAgent" in event, false);
  });

  await t.test("disabled links, unpublished profiles, and missing links are not counted", async () => {
    await Link.updateOne({ _id: link._id }, { $set: { enabled: false } });
    assert.equal((await request(`/api/redirect/${profile.slug}/${link._id}`)).status, 404);
    await Link.updateOne({ _id: link._id }, { $set: { enabled: true } });
    await Profile.updateOne({ _id: profile._id }, { $set: { enabled: false } });
    assert.equal((await request(`/api/redirect/${profile.slug}/${link._id}`)).status, 404);
    await Profile.updateOne({ _id: profile._id }, { $set: { enabled: true } });
    assert.equal((await request(`/api/redirect/${profile.slug}/000000000000000000000000`)).status, 404);
    assert.equal(await ClickEvent.countDocuments({ profile: profile._id }), 1);
  });

  await t.test("date range and ownership limits apply to analytics", async () => {
    await ClickEvent.create({ profile: profile._id, link: link._id, linkTitle: link.title, createdAt: new Date(Date.now() - 45 * 86400000) });
    const response = await request("/api/analytics?range=7d", { cookie });
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(result.totalClicks, 1);
    assert.equal(result.daily.length, 7);
    assert.equal(result.topLinks[0].title, link.title);
    assert.equal((await request("/api/analytics?range=bad", { cookie })).status, 400);
    const other = await request("/api/analytics?range=90d", { cookie: secondCookie });
    assert.equal((await other.json()).totalClicks, 0);
    assert.equal((await request("/api/analytics")).status, 401);
  });

  await t.test("XML validation previews without writes and confirmed import is protected", async () => {
    assert.equal((await request("/api/profile/me/import/validate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ xml: "<linknest/>" }) })).status, 401);
    const exported = profileToXml({ slug: `import-${runId.slice(0, 10)}`, displayName: "Imported <Profile>", bio: "Safe & valid", avatarUrl: "", theme: "midnight", enabled: true, socialLinks: [] }, [
      { title: "Imported link", destinationUrl: "https://example.net/imported", description: "A test", icon: "↗", platform: "website", displayOrder: 0, enabled: true },
    ]);
    const validate = await request("/api/profile/me/import/validate", { method: "POST", cookie, headers: { "content-type": "application/json" }, body: JSON.stringify({ xml: exported }) });
    const preview = await validate.json();
    assert.equal(validate.status, 200);
    assert.equal(preview.preview.profile.displayName, "Imported <Profile>");
    assert.equal((await Profile.findById(profile._id).lean()).displayName, "Analytics test");
    assert.equal((await request("/api/profile/me/import", { method: "POST", cookie, headers: { "content-type": "application/json" }, body: JSON.stringify({ xml: exported }) })).status, 400);
    const unsafe = await request("/api/profile/me/import/validate", { method: "POST", cookie, headers: { "content-type": "application/json" }, body: JSON.stringify({ xml: `<!DOCTYPE linknest SYSTEM 'file:///etc/passwd'>${exported}` }) });
    assert.equal(unsafe.status, 400);
    const imported = await request("/api/profile/me/import", { method: "POST", cookie, headers: { "content-type": "application/json" }, body: JSON.stringify({ xml: exported, confirm: true }) });
    const importedBody = await imported.json();
    assert.equal(imported.status, 200);
    assert.equal(importedBody.profile.slug, `import-${runId.slice(0, 10)}`);
    assert.equal(importedBody.links, 1);
  });
});
