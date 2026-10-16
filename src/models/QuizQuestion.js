const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema(
  {
    text: {
      en: { type: String, required: true, trim: true, maxlength: 1000 },
      hi: { type: String, trim: true, maxlength: 1000 },
    },
    options: {
      type: [String],
      required: true,
      validate: [(value) => value.length === 4, "Question must have exactly 4 options."],
    },
    correctIndex: { type: Number, required: true, min: 0, max: 3 },
    explanation: { type: String, required: true, trim: true, maxlength: 1200 },
    category: { type: String, required: true, trim: true, maxlength: 80, index: true },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
      default: "General Knowledge",
      index: true,
    },
    difficulty: { type: Number, default: 1, min: 1, max: 5 },
    scheduledDate: { type: Date, default: null, index: true },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, collection: "quiz_questions" }
);

questionSchema.index({ active: 1, scheduledDate: 1, category: 1 });

module.exports = mongoose.models.QuizQuestion || mongoose.model("QuizQuestion", questionSchema);
