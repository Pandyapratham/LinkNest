function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value, allowedKeys) {
  return isPlainObject(value) && Object.keys(value).every((key) => allowedKeys.includes(key));
}

function normalizeSlug(value) {
  if (typeof value !== "string") return null;
  const slug = value.trim().toLowerCase();
  return /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/.test(slug) ? slug : null;
}

function normalizeHttpUrl(value, { allowEmpty = false } = {}) {
  if (typeof value !== "string") return null;
  const candidate = value.trim();
  if (allowEmpty && candidate === "") return "";
  if (!candidate || candidate.length > 2048) return null;

  try {
    const parsed = new URL(candidate);
    if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname) return null;
    if (parsed.username || parsed.password) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

module.exports = { hasOnlyKeys, isPlainObject, normalizeHttpUrl, normalizeSlug };
