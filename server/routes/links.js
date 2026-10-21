const express = require("express");
const mongoose = require("mongoose");
const Link = require("../models/Link");
const Profile = require("../models/Profile");
const { hasOnlyKeys, normalizeHttpUrl } = require("../utils/validation");

const router = express.Router();
const LINK_KEYS = ["title", "destinationUrl", "description", "icon", "platform", "displayOrder", "enabled"];
const PLATFORMS = ["website", "instagram", "tiktok", "youtube", "x", "linkedin", "github", "spotify", "facebook", "other"];
const LINK_ID_PATTERN = /^[a-f\d]{24}$/i;

function linkJson(link) {
  return {
    id: String(link._id),
    title: link.title,
    destinationUrl: link.destinationUrl,
    description: link.description,
    icon: link.icon,
    platform: link.platform,
    displayOrder: link.displayOrder,
    enabled: link.enabled,
    createdAt: link.createdAt,
    updatedAt: link.updatedAt,
  };
}

function normalizeLinkBody(body, isCreate) {
  if (!hasOnlyKeys(body, LINK_KEYS)) return { error: "Invalid link fields" };
  if (Object.keys(body).length === 0) return { error: "Provide at least one link field" };

  const value = {};
  if (body.title !== undefined) {
    if (typeof body.title !== "string" || !body.title.trim() || body.title.trim().length > 80) {
      return { error: "Title is required and must be 80 characters or fewer" };
    }
    value.title = body.title.trim();
  }
  if (body.destinationUrl !== undefined) {
    const destinationUrl = normalizeHttpUrl(body.destinationUrl);
    if (!destinationUrl) return { error: "Destination URL must use HTTP or HTTPS" };
    value.destinationUrl = destinationUrl;
  }
  if (body.description !== undefined) {
    if (typeof body.description !== "string" || body.description.trim().length > 280) {
      return { error: "Description must be 280 characters or fewer" };
    }
    value.description = body.description.trim();
  }
  if (body.icon !== undefined) {
    if (typeof body.icon !== "string" || body.icon.trim().length > 50) return { error: "Icon must be 50 characters or fewer" };
    value.icon = body.icon.trim();
  }
  if (body.platform !== undefined) {
    const platform = typeof body.platform === "string" ? body.platform.trim().toLowerCase() : "";
    if (!PLATFORMS.includes(platform)) return { error: "Unsupported link platform" };
    value.platform = platform;
  }
  if (body.displayOrder !== undefined) {
    if (!Number.isInteger(body.displayOrder) || body.displayOrder < 0 || body.displayOrder > 10000) {
      return { error: "Display order must be an integer from 0 to 10000" };
    }
    value.displayOrder = body.displayOrder;
  }
  if (body.enabled !== undefined) {
    if (typeof body.enabled !== "boolean") return { error: "Enabled must be a boolean" };
    value.enabled = body.enabled;
  }

  if (isCreate && (!value.title || !value.destinationUrl)) {
    return { error: "Title and destination URL are required" };
  }
  return { value };
}

async function getOwnedProfile(userId) {
  return Profile.findOne({ owner: userId });
}

function handleLinkError(res, error) {
  if (error?.name === "ValidationError" || error?.name === "CastError") {
    return res.status(400).json({ success: false, message: "Invalid link details" });
  }
  console.error("Link request failed.");
  return res.status(500).json({ success: false, message: "Unable to complete link request" });
}

router.get("/me/links", async (req, res) => {
  try {
    const profile = await getOwnedProfile(req.user._id);
    if (!profile) return res.status(404).json({ success: false, message: "Profile not found" });
    const links = await Link.find({ profile: profile._id }).sort({ displayOrder: 1, createdAt: 1, _id: 1 });
    return res.json({ success: true, links: links.map(linkJson) });
  } catch (error) {
    return handleLinkError(res, error);
  }
});

router.post("/me/links", async (req, res) => {
  const normalized = normalizeLinkBody(req.body, true);
  if (normalized.error) return res.status(400).json({ success: false, message: normalized.error });

  try {
    const profile = await getOwnedProfile(req.user._id);
    if (!profile) return res.status(404).json({ success: false, message: "Profile not found" });

    const currentCount = await Link.countDocuments({ profile: profile._id });
    if (currentCount >= 100) return res.status(409).json({ success: false, message: "This profile has reached its 100-link limit" });

    let displayOrder = normalized.value.displayOrder;
    if (displayOrder === undefined) {
      const lastLink = await Link.findOne({ profile: profile._id }).sort({ displayOrder: -1 }).select("displayOrder").lean();
      displayOrder = lastLink ? lastLink.displayOrder + 1 : 0;
      if (displayOrder > 10000) return res.status(409).json({ success: false, message: "This profile has reached its link limit" });
    }

    const link = await Link.create({ ...normalized.value, displayOrder, profile: profile._id });
    return res.status(201).json({ success: true, link: linkJson(link) });
  } catch (error) {
    return handleLinkError(res, error);
  }
});

router.patch("/me/links/reorder", async (req, res) => {
  if (!hasOnlyKeys(req.body, ["linkIds"]) || !Array.isArray(req.body.linkIds) || req.body.linkIds.length > 100) {
    return res.status(400).json({ success: false, message: "Provide an ordered list of up to 100 link IDs" });
  }
  const { linkIds } = req.body;
  if (linkIds.some((id) => typeof id !== "string" || !LINK_ID_PATTERN.test(id)) || new Set(linkIds).size !== linkIds.length) {
    return res.status(400).json({ success: false, message: "Link IDs must be valid and unique" });
  }

  try {
    const profile = await getOwnedProfile(req.user._id);
    if (!profile) return res.status(404).json({ success: false, message: "Profile not found" });
    const ownedLinks = await Link.find({ profile: profile._id }).select("_id").lean();
    const ownedIds = new Set(ownedLinks.map((link) => String(link._id)));
    if (ownedIds.size !== linkIds.length || linkIds.some((id) => !ownedIds.has(id))) {
      return res.status(404).json({ success: false, message: "One or more links were not found in this profile" });
    }

    if (linkIds.length) {
      await Link.bulkWrite(linkIds.map((id, displayOrder) => ({
        updateOne: {
          filter: { _id: new mongoose.Types.ObjectId(id), profile: profile._id },
          update: { $set: { displayOrder } },
        },
      })), { ordered: true });
    }

    const links = await Link.find({ profile: profile._id }).sort({ displayOrder: 1, createdAt: 1, _id: 1 });
    return res.json({ success: true, links: links.map(linkJson) });
  } catch (error) {
    return handleLinkError(res, error);
  }
});

router.patch("/me/links/:linkId", async (req, res) => {
  if (!LINK_ID_PATTERN.test(req.params.linkId)) return res.status(400).json({ success: false, message: "Invalid link ID" });
  const normalized = normalizeLinkBody(req.body, false);
  if (normalized.error) return res.status(400).json({ success: false, message: normalized.error });

  try {
    const profile = await getOwnedProfile(req.user._id);
    if (!profile) return res.status(404).json({ success: false, message: "Profile not found" });
    const link = await Link.findOneAndUpdate(
      { _id: req.params.linkId, profile: profile._id },
      { $set: normalized.value },
      { returnDocument: "after", runValidators: true },
    );
    if (!link) return res.status(404).json({ success: false, message: "Link not found" });
    return res.json({ success: true, link: linkJson(link) });
  } catch (error) {
    return handleLinkError(res, error);
  }
});

router.delete("/me/links/:linkId", async (req, res) => {
  if (!LINK_ID_PATTERN.test(req.params.linkId)) return res.status(400).json({ success: false, message: "Invalid link ID" });

  try {
    const profile = await getOwnedProfile(req.user._id);
    if (!profile) return res.status(404).json({ success: false, message: "Profile not found" });
    const link = await Link.findOneAndDelete({ _id: req.params.linkId, profile: profile._id });
    if (!link) return res.status(404).json({ success: false, message: "Link not found" });
    return res.status(204).end();
  } catch (error) {
    return handleLinkError(res, error);
  }
});

module.exports = router;
