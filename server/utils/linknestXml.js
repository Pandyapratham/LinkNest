const fs = require("node:fs");
const path = require("node:path");
const libxml = require("libxmljs2");
const { normalizeHttpUrl, normalizeSlug } = require("./validation");

const XSD_PATH = path.join(__dirname, "..", "schemas", "linknest.xsd");
const MAX_XML_BYTES = 64 * 1024;
const THEMES = new Set(["soft", "light", "dark", "midnight", "sunset"]);
const SOCIAL_PLATFORMS = new Set(["instagram", "tiktok", "youtube", "x", "linkedin", "github", "facebook", "website"]);
const LINK_PLATFORMS = new Set(["website", "instagram", "tiktok", "youtube", "x", "linkedin", "github", "spotify", "facebook", "other"]);

function xmlEscape(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function profileToXml(profile, links) {
  const socials = (profile.socialLinks || []).map(item => `      <socialLink><platform>${xmlEscape(item.platform)}</platform><url>${xmlEscape(item.url)}</url><label>${xmlEscape(item.label)}</label></socialLink>`).join("\n");
  const linkXml = links.map(link => `    <link><title>${xmlEscape(link.title)}</title><destinationUrl>${xmlEscape(link.destinationUrl)}</destinationUrl><description>${xmlEscape(link.description)}</description><icon>${xmlEscape(link.icon)}</icon><platform>${xmlEscape(link.platform)}</platform><displayOrder>${link.displayOrder}</displayOrder><enabled>${link.enabled}</enabled></link>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<linknest version="1">\n  <profile>\n    <slug>${xmlEscape(profile.slug)}</slug>\n    <displayName>${xmlEscape(profile.displayName)}</displayName>\n    <bio>${xmlEscape(profile.bio)}</bio>\n    <avatarUrl>${xmlEscape(profile.avatarUrl)}</avatarUrl>\n    <theme>${xmlEscape(profile.theme)}</theme>\n    <enabled>${profile.enabled}</enabled>\n    <socialLinks>\n${socials}${socials ? "\n" : ""}    </socialLinks>\n  </profile>\n  <links>\n${linkXml}${linkXml ? "\n" : ""}  </links>\n</linknest>`;
}

function textAt(document, selector) {
  const node = document.get(selector);
  return node ? node.text().trim() : "";
}

function parseAndValidateLinknestXml(source) {
  if (typeof source !== "string" || Buffer.byteLength(source, "utf8") > MAX_XML_BYTES) {
    return { error: "XML must be text no larger than 64 KB" };
  }
  if (/<!\s*(DOCTYPE|ENTITY)\b/i.test(source)) {
    return { error: "DTD and entity declarations are not accepted" };
  }

  let document;
  let schema;
  try {
    document = libxml.parseXml(source, { nonet: true, noent: false, dtdload: false, xinclude: false, recover: false });
    schema = libxml.parseXml(fs.readFileSync(XSD_PATH, "utf8"), { nonet: true, noent: false, dtdload: false, xinclude: false, recover: false });
  } catch {
    return { error: "The XML is malformed or could not be parsed" };
  }
  if (!document.validate(schema)) {
    return { error: "The XML does not match the LinkNest XSD schema" };
  }

  const profile = {
    slug: normalizeSlug(textAt(document, "/linknest/profile/slug")),
    displayName: textAt(document, "/linknest/profile/displayName"),
    bio: textAt(document, "/linknest/profile/bio"),
    avatarUrl: textAt(document, "/linknest/profile/avatarUrl"),
    theme: textAt(document, "/linknest/profile/theme"),
    enabled: textAt(document, "/linknest/profile/enabled") === "true",
    socialLinks: document.find("/linknest/profile/socialLinks/socialLink").map(node => ({
      platform: node.get("platform").text().trim(),
      url: node.get("url").text().trim(),
      label: node.get("label").text().trim(),
    })),
  };
  const links = document.find("/linknest/links/link").map(node => ({
    title: node.get("title").text().trim(),
    destinationUrl: node.get("destinationUrl").text().trim(),
    description: node.get("description").text().trim(),
    icon: node.get("icon").text().trim(),
    platform: node.get("platform").text().trim(),
    displayOrder: Number(node.get("displayOrder").text().trim()),
    enabled: node.get("enabled").text().trim() === "true",
  }));

  if (!profile.slug || !profile.displayName || !THEMES.has(profile.theme) || (profile.avatarUrl && !normalizeHttpUrl(profile.avatarUrl))) {
    return { error: "Profile values are invalid" };
  }
  if (profile.socialLinks.length > 8 || profile.socialLinks.some(item => !SOCIAL_PLATFORMS.has(item.platform) || !normalizeHttpUrl(item.url) || item.label.length > 30)) {
    return { error: "One or more social links are invalid" };
  }
  if (links.length > 100 || links.some(link => !link.title || link.title.length > 80 || !normalizeHttpUrl(link.destinationUrl) || link.description.length > 280 || link.icon.length > 50 || !LINK_PLATFORMS.has(link.platform) || !Number.isInteger(link.displayOrder) || link.displayOrder < 0 || link.displayOrder > 10000)) {
    return { error: "One or more links are invalid" };
  }
  profile.avatarUrl = profile.avatarUrl ? normalizeHttpUrl(profile.avatarUrl) : "";
  profile.socialLinks = profile.socialLinks.map(item => ({ ...item, url: normalizeHttpUrl(item.url) }));
  links.forEach(link => { link.destinationUrl = normalizeHttpUrl(link.destinationUrl); });
  return { value: { profile, links } };
}

module.exports = { MAX_XML_BYTES, parseAndValidateLinknestXml, profileToXml };
