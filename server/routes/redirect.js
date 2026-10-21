const express = require("express");
const ClickEvent = require("../models/ClickEvent");
const Link = require("../models/Link");
const Profile = require("../models/Profile");
const { normalizeHttpUrl, normalizeSlug } = require("../utils/validation");

const router = express.Router();
const LINK_ID_PATTERN = /^[a-f\d]{24}$/i;

function classifyDevice(agent = "") {
  if (/ipad|tablet/i.test(agent)) return "tablet";
  if (/mobile|iphone|android/i.test(agent)) return "mobile";
  if (agent) return "desktop";
  return "unknown";
}

function safeReferrerDomain(value) {
  try { return new URL(value).hostname.slice(0, 253) } catch { return "" }
}

router.get("/:slug/:linkId", async (req, res) => {
  const slug = normalizeSlug(req.params.slug);
  if (!slug || !LINK_ID_PATTERN.test(req.params.linkId)) return res.status(404).json({ success: false, message: "Link not found" });
  try {
    const profile = await Profile.findOne({ slug, enabled: true }).select("_id").lean();
    if (!profile) return res.status(404).json({ success: false, message: "Link not found" });
    const link = await Link.findOne({ _id: req.params.linkId, profile: profile._id, enabled: true }).lean();
    if (!link) return res.status(404).json({ success: false, message: "Link not found" });
    const destination = normalizeHttpUrl(link.destinationUrl);
    if (!destination) return res.status(410).json({ success: false, message: "This destination is no longer available" });
    await ClickEvent.create({
      profile: profile._id,
      link: link._id,
      linkTitle: link.title,
      deviceType: classifyDevice(req.get("user-agent")),
      referrerDomain: safeReferrerDomain(req.get("referer") || ""),
    });
    res.set("Cache-Control", "no-store");
    res.set("Referrer-Policy", "no-referrer");
    return res.redirect(302, destination);
  } catch {
    console.error("Public click could not be recorded.");
    return res.status(503).json({ success: false, message: "Unable to open this link right now" });
  }
});

module.exports = router;
