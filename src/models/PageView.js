const mongoose = require("mongoose");

const pageViewSchema = new mongoose.Schema(
  {
    visitorId: { type: String, required: true, trim: true, maxlength: 128, index: true },
    dateKey: { type: String, required: true, index: true },
    path: { type: String, required: true, trim: true, maxlength: 250 },
    referrer: { type: String, default: "", maxlength: 250 },
    landingPage: { type: String, default: "", maxlength: 250 },
    device: { type: String, default: "", maxlength: 60 },
    source: { type: String, default: "direct", maxlength: 100 },
  },
  { timestamps: true, collection: "page_views" }
);

pageViewSchema.index({ dateKey: 1, visitorId: 1 });

module.exports = mongoose.models.PageView || mongoose.model("PageView", pageViewSchema);
