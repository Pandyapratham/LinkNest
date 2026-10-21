const express = require("express");
const mongoose = require("mongoose");
const Link = require("../models/Link");
const Profile = require("../models/Profile");
const { hasOnlyKeys } = require("../utils/validation");
const { MAX_XML_BYTES, parseAndValidateLinknestXml, profileToXml } = require("../utils/linknestXml");

const router = express.Router();

function getXmlInput(req) {
  if (!hasOnlyKeys(req.body, ["xml"]) || typeof req.body.xml !== "string") return { error: "Provide an XML string" };
  if (Buffer.byteLength(req.body.xml, "utf8") > MAX_XML_BYTES) return { error: "XML must be no larger than 64 KB" };
  return { xml: req.body.xml };
}

router.get("/me/export.xml", async (req, res) => {
  try {
    const profile = await Profile.findOne({ owner: req.user._id }).lean();
    if (!profile) return res.status(404).json({ success: false, message: "Profile not found" });
    const links = await Link.find({ profile: profile._id }).sort({ displayOrder: 1, createdAt: 1 }).lean();
    res.type("application/xml; charset=utf-8");
    res.set("Content-Disposition", 'attachment; filename="linknest-export.xml"');
    return res.send(profileToXml(profile, links));
  } catch {
    return res.status(500).json({ success: false, message: "Unable to export profile XML" });
  }
});

router.post("/me/import/validate", (req, res) => {
  const input = getXmlInput(req);
  if (input.error) return res.status(400).json({ success: false, message: input.error });
  const result = parseAndValidateLinknestXml(input.xml);
  if (result.error) return res.status(400).json({ success: false, message: result.error });
  return res.json({ success: true, preview: result.value });
});

router.post("/me/import", async (req, res) => {
  if (!hasOnlyKeys(req.body, ["xml", "confirm"]) || req.body.confirm !== true) {
    return res.status(400).json({ success: false, message: "Validate the XML and explicitly confirm the import" });
  }
  if (typeof req.body.xml !== "string" || Buffer.byteLength(req.body.xml, "utf8") > MAX_XML_BYTES) {
    return res.status(400).json({ success: false, message: "XML must be text no larger than 64 KB" });
  }
  const result = parseAndValidateLinknestXml(req.body.xml);
  if (result.error) return res.status(400).json({ success: false, message: result.error });

  const session = await mongoose.startSession();
  try {
    let importedProfile;
    await session.withTransaction(async () => {
      const profile = await Profile.findOne({ owner: req.user._id }).session(session);
      if (!profile) throw Object.assign(new Error("Profile not found"), { statusCode: 404 });
      Object.assign(profile, result.value.profile);
      await profile.save({ session });
      await Link.deleteMany({ profile: profile._id }).session(session);
      if (result.value.links.length) {
        await Link.insertMany(result.value.links.map(link => ({ ...link, profile: profile._id })), { session, ordered: true });
      }
      importedProfile = profile;
    });
    const links = await Link.find({ profile: importedProfile._id }).sort({ displayOrder: 1, createdAt: 1 }).session(session);
    return res.json({ success: true, profile: { id: String(importedProfile._id), slug: importedProfile.slug, displayName: importedProfile.displayName }, links: links.length });
  } catch (error) {
    if (error.statusCode === 404) return res.status(404).json({ success: false, message: error.message });
    if (error.code === 11000) return res.status(409).json({ success: false, message: "The imported profile slug is already taken" });
    if (error.name === "ValidationError") return res.status(400).json({ success: false, message: "Imported profile or link values are invalid" });
    console.error("Profile XML import failed.");
    return res.status(500).json({ success: false, message: "Unable to import profile XML" });
  } finally {
    await session.endSession();
  }
});

module.exports = router;
