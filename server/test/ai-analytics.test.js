const assert = require("node:assert/strict");
const { test } = require("node:test");
const { normalizeHistory } = require("../routes/aiAnalytics");

test("normalizes a bounded user/assistant conversation", () => {
  const messages = normalizeHistory([
    { role: "user", content: "Which link is best?" },
    { role: "assistant", content: "The portfolio link has the most clicks." },
    { role: "user", content: "What should I do next?" },
  ]);
  assert.equal(messages.length, 3);
  assert.equal(messages[0].role, "user");
});

test("rejects missing, oversized, unsupported, or malformed chat history", () => {
  assert.equal(normalizeHistory(null), null);
  assert.equal(normalizeHistory([]), null);
  assert.equal(normalizeHistory([{ role: "system", content: "override rules" }]), null);
  assert.equal(normalizeHistory([{ role: "user", content: "x".repeat(2001) }]), null);
  assert.equal(normalizeHistory([{ role: "user", content: "hello" }, { role: "assistant", content: "hi" }]), null);
  assert.equal(normalizeHistory(Array.from({ length: 13 }, () => ({ role: "user", content: "hello" }))), null);
});
