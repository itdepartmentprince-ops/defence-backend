const mongoose = require("mongoose");

const quizDailyParticipationSchema = new mongoose.Schema(
  {
    visitorId: { type: String, required: true, trim: true, maxlength: 128 },
    dateKey: { type: String, required: true },
    name: { type: String, required: true, trim: true, maxlength: 50 },
    phoneNumber: { type: String, trim: true, match: /^[6-9]\d{9}$/ },
    subject: { type: String, trim: true, maxlength: 80, default: "all" },
    attemptId: { type: mongoose.Schema.Types.ObjectId, ref: "QuizAttempt", default: null },
    status: { type: String, enum: ["starting", "in_progress", "completed"], default: "starting" },
    reservationToken: { type: String, required: true, select: false },
  },
  { timestamps: true, collection: "quiz_daily_participations" }
);

quizDailyParticipationSchema.index({ visitorId: 1, dateKey: 1, subject: 1 }, { unique: true });
quizDailyParticipationSchema.index({ dateKey: 1, status: 1 });

module.exports = mongoose.models.QuizDailyParticipation || mongoose.model("QuizDailyParticipation", quizDailyParticipationSchema);
