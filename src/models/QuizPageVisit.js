const mongoose = require("mongoose");

const quizPageVisitSchema = new mongoose.Schema(
  {
    visitorId: { type: String, required: true, trim: true, maxlength: 128 },
    dateKey: { type: String, required: true },
  },
  { timestamps: true, collection: "quiz_page_visits" }
);

quizPageVisitSchema.index({ dateKey: 1 });

module.exports =
  mongoose.models.QuizPageVisit ||
  mongoose.model("QuizPageVisit", quizPageVisitSchema);
