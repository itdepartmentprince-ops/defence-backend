const { z } = require("zod");
const Visitor = require("../models/Visitor");
const PageView = require("../models/PageView");
const QuizPageVisit = require("../models/QuizPageVisit");
const { toDateKey } = require("../utils/quizDate");

const trackSchema = z.object({
  visitorId: z.string().trim().min(16).max(128).regex(/^[A-Za-z0-9_-]+$/),
  path: z.string().trim().min(1).max(250).refine((value) => value.startsWith("/") && !value.startsWith("//")),
  referrer: z.string().trim().max(250).optional().default(""),
  landingPage: z.string().trim().max(250).optional().default("/"),
  device: z.enum(["mobile", "desktop", "tablet", "unknown"]).optional().default("unknown"),
  browser: z.string().trim().max(80).optional().default(""),
  os: z.string().trim().max(60).optional().default(""),
  country: z.string().trim().max(60).optional().default(""),
  utm: z.record(z.string(), z.string().max(100)).optional().default({}),
}).strict();

const clean = (value, maxLength) => String(value || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, maxLength);

const trackPageView = async (req, res) => {
  const parsed = trackSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: "Invalid tracking data." });

  const { visitorId, path, referrer, landingPage, device, browser, os, country, utm } = parsed.data;
  if (/^\/admin(?:\/|$)/i.test(path)) {
    return res.status(202).json({ success: true, tracked: false });
  }

  const now = new Date();
  const source = clean(utm.utm_source || (referrer ? "referral" : "direct"), 100);
  const safePath = clean(path, 250);

  await Visitor.findOneAndUpdate(
    { visitorId },
    {
      $setOnInsert: { visitorId, firstSeenAt: now },
      $set: {
        lastSeenAt: now,
        lastPage: safePath,
        landingPage: clean(landingPage || safePath, 250),
        referrer: clean(referrer, 250),
        device,
        browser: clean(browser, 80),
        os: clean(os, 60),
        country: clean(country, 60),
        source,
      },
      $inc: { totalPageViews: 1 },
    },
    {
      upsert: true,
      returnDocument: "after",
      setDefaultsOnInsert: false,
    }
  );

  await PageView.create({
    visitorId,
    dateKey: toDateKey(now),
    path: safePath,
    referrer: clean(referrer, 250),
    landingPage: clean(landingPage || safePath, 250),
    device,
    source,
  });

  if (/^\/quiz(?:\/|$)/.test(safePath)) {
    const countedVisitor = await Visitor.findOneAndUpdate(
      {
        visitorId,
        $or: [
          { quizLastCountedAt: { $exists: false } },
          { quizLastCountedAt: null },
          {
            quizLastCountedAt: {
              $lte: new Date(now.getTime() - 24 * 60 * 60 * 1000),
            },
          },
        ],
      },
      { $set: { quizLastCountedAt: now } },
      { returnDocument: "after" }
    );

    if (countedVisitor) {
      await QuizPageVisit.create({
        visitorId,
        dateKey: toDateKey(now),
      });
    }
  }

  return res.status(202).json({ success: true });
};

module.exports = { trackPageView };
