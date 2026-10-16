const mongoose = require("mongoose");

const visitorSchema = new mongoose.Schema(
  {
    visitorId: { type: String, required: true, unique: true, trim: true, maxlength: 128 },
    name: { type: String, trim: true, maxlength: 50, default: "" },
    phoneNumber: { type: String, trim: true, match: /^[6-9]\d{9}$/, default: "" },
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now, index: true },
    quizLastCountedAt: { type: Date },
    totalVisits: { type: Number, default: 0, min: 0 },
    totalPageViews: { type: Number, default: 0, min: 0 },
    landingPage: { type: String, default: "", maxlength: 250 },
    lastPage: { type: String, default: "", maxlength: 250 },
    referrer: { type: String, default: "", maxlength: 250 },
    country: { type: String, default: "", maxlength: 60 },
    city: { type: String, default: "", maxlength: 60 },
    device: { type: String, default: "", maxlength: 60 },
    browser: { type: String, default: "", maxlength: 80 },
    os: { type: String, default: "", maxlength: 60 },
    source: { type: String, default: "direct", maxlength: 100 },
  },
  { timestamps: true, collection: "visitors" }
);

module.exports = mongoose.models.Visitor || mongoose.model("Visitor", visitorSchema);
