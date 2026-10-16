const mongoose = require("mongoose");

const quizSettingSchema = new mongoose.Schema(
  {
    dateKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },

    durationMinutes: {
      type: Number,
      required: true,
      min: 1,
      max: 180,
      default: 15,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "quiz_settings",
  }
);

quizSettingSchema.index({
  dateKey: 1,
  isActive: 1,
});

module.exports =
  mongoose.models.QuizSetting ||
  mongoose.model("QuizSetting", quizSettingSchema);