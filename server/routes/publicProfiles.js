const express = require("express");
const Link = require("../models/Link");
const Profile = require("../models/Profile");
const { normalizeSlug } = require("../utils/validation");

const router = express.Router();

router.get("/:slug", async (req, res) => {
  const slug = normalizeSlug(req.params.slug);
  if (!slug) return res.status(404).json({ success: false, message: "Profile not found" });

  try {
    const profile = await Profile.findOne({ slug, enabled: true }).lean();
    if (!profile) return res.status(404).json({ success: false, message: "Profile not found" });

    const links = await Link.find({ profile: profile._id, enabled: true })
      .select("_id title destinationUrl description icon platform displayOrder")
      .sort({ displayOrder: 1, createdAt: 1, _id: 1 })
      .lean();

    return res.json({
      success: true,
      profile: {
        slug: profile.slug,
        displayName: profile.displayName,
        bio: profile.bio,
        avatarUrl: profile.avatarUrl,
        theme: profile.theme,
        backgroundColor: profile.backgroundColor || "#fbf9ff",
        accentColor: profile.accentColor || "#8062e6",
        fontFamily: profile.fontFamily || "system",
        buttonStyle: profile.buttonStyle || "rounded",
        layout: profile.layout || "classic",
        bannerUrl: profile.bannerUrl || "",
        socialLinks: (profile.socialLinks || []).map(({ platform, url, label }) => ({ platform, url, label })),
        links: links.map(({ _id, title, destinationUrl, description, icon, platform, displayOrder }) => ({
          id: String(_id),
          title,
          destinationUrl,
          description,
          icon,
          platform,
          displayOrder,
        })),
      },
    });
  } catch {
    console.error("Public profile request failed.");
    return res.status(500).json({ success: false, message: "Unable to retrieve profile" });
  }
});

module.exports = router;
