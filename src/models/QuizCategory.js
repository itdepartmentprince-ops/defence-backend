const mongoose = require("mongoose");

const quizCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    normalizedName: { type: String, required: true, unique: true, index: true },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, collection: "quiz_categories" }
);

module.exports = mongoose.models.QuizCategory || mongoose.model("QuizCategory", quizCategorySchema);
