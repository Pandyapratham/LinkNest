const assert = require("node:assert/strict");
const test = require("node:test");
const { parseAndValidateLinknestXml, profileToXml } = require("../utils/linknestXml");

const profile = {
  slug: "demo-user",
  displayName: "Demo & Maker",
  bio: "<makers> create",
  avatarUrl: "",
  theme: "soft",
  enabled: true,
  socialLinks: [{ platform: "website", url: "https://example.com/about?a=1&b=2", label: "Home" }],
};
const links = [{ title: "Portfolio <2026>", destinationUrl: "https://example.com/?a=1&b=2", description: "Work & notes", icon: "✦", platform: "website", displayOrder: 0, enabled: true }];

test("LinkNest XML export escapes data and validates against the local XSD", () => {
  const xml = profileToXml(profile, links);
  assert.match(xml, /Demo &amp; Maker/);
  assert.match(xml, /Portfolio &lt;2026&gt;/);
  const result = parseAndValidateLinknestXml(xml);
  assert.equal(result.error, undefined);
  assert.equal(result.value.profile.displayName, profile.displayName);
  assert.equal(result.value.links[0].title, links[0].title);
  assert.equal(result.value.links[0].destinationUrl, links[0].destinationUrl);
});

test("XML validation rejects unsafe schemes, invalid structures, DTDs, entities, and oversized input", () => {
  const unsafe = profileToXml(profile, [{ ...links[0], destinationUrl: "javascript:alert(1)" }]);
  assert.match(parseAndValidateLinknestXml(unsafe).error, /XSD schema|invalid/i);
  assert.match(parseAndValidateLinknestXml("<!DOCTYPE linknest SYSTEM 'file:///etc/passwd'><linknest/>").error, /DTD/);
  assert.match(parseAndValidateLinknestXml("<!ENTITY x 'boom'><linknest/>").error, /DTD/);
  assert.match(parseAndValidateLinknestXml("<linknest><profile/></linknest>").error, /schema/);
  assert.match(parseAndValidateLinknestXml("x".repeat(65 * 1024)).error, /64 KB/);
});
