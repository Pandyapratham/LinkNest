const mongoose = require("mongoose");

const clickEventSchema = new mongoose.Schema({
  profile: { type: mongoose.Schema.Types.ObjectId, ref: "Profile", required: true },
  link: { type: mongoose.Schema.Types.ObjectId, ref: "Link", required: true },
  linkTitle: { type: String, required: true, trim: true, maxlength: 80 },
  deviceType: { type: String, enum: ["desktop", "mobile", "tablet", "unknown"], default: "unknown" },
  referrerDomain: { type: String, trim: true, maxlength: 253, default: "" },
}, { timestamps: { createdAt: true, updatedAt: false } });

clickEventSchema.index({ profile: 1, createdAt: 1 });
clickEventSchema.index({ link: 1, createdAt: 1 });

module.exports = mongoose.models.ClickEvent || mongoose.model("ClickEvent", clickEventSchema);
