const express = require("express");
const ClickEvent = require("../models/ClickEvent");
const Profile = require("../models/Profile");

const router = express.Router();
const RANGE_DAYS = { "7d": 7, "30d": 30, "90d": 90 };

router.get("/", async (req, res) => {
  const range = typeof req.query.range === "string" ? req.query.range : "7d";
  if (!Object.hasOwn(RANGE_DAYS, range)) return res.status(400).json({ success: false, message: "Range must be 7d, 30d, or 90d" });
  try {
    const profile = await Profile.findOne({ owner: req.user._id }).select("_id").lean();
    if (!profile) return res.status(404).json({ success: false, message: "Profile not found" });
    const since = new Date(Date.now() - RANGE_DAYS[range] * 24 * 60 * 60 * 1000);
    const [result] = await ClickEvent.aggregate([
      { $match: { profile: profile._id, createdAt: { $gte: since } } },
      { $facet: {
        total: [{ $count: "clicks" }],
        daily: [
          { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "UTC" } }, clicks: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ],
        topLinks: [
          { $group: { _id: "$link", title: { $first: "$linkTitle" }, clicks: { $sum: 1 } } },
          { $sort: { clicks: -1, title: 1 } },
        ],
        devices: [{ $group: { _id: "$deviceType", clicks: { $sum: 1 } } }],
      } },
    ]);
    const totalClicks = result?.total?.[0]?.clicks || 0;
    const dailyMap = new Map((result?.daily || []).map(item => [item._id, item.clicks]));
    const daily = [];
    for (let offset = RANGE_DAYS[range] - 1; offset >= 0; offset -= 1) {
      const day = new Date();
      day.setUTCHours(0, 0, 0, 0);
      day.setUTCDate(day.getUTCDate() - offset);
      const key = day.toISOString().slice(0, 10);
      daily.push({ date: key, clicks: dailyMap.get(key) || 0 });
    }
    return res.json({
      success: true,
      range,
      totalClicks,
      daily,
      topLinks: result?.topLinks || [],
      devices: result?.devices || [],
      privacy: "No raw IP addresses or full user-agent strings are stored; device category is a coarse estimate.",
    });
  } catch {
    console.error("Analytics query failed.");
    return res.status(500).json({ success: false, message: "Unable to retrieve analytics" });
  }
});

module.exports = router;
