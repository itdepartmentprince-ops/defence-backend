const express = require("express");
const { trackPageView } = require("../controllers/analyticsController");
const asyncHandler = require("../utils/asyncHandler");
const rateLimit = require("../middleware/rateLimit");

const router = express.Router();
const trackingLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: "Too many tracking requests.",
});

router.post("/track", trackingLimit, asyncHandler(trackPageView));

module.exports = router;
