const mongoose = require("mongoose");

const answerSchema = new mongoose.Schema(
  {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    category: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "General",
    },
    subject: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "General Knowledge",
    },
    questionText: {
      type: String,
      trim: true,
      maxlength: 1000,
      required: true,
    },
    questionHi: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    options: {
      type: [String],
      required: true,
      validate: [(value) => value.length === 4],
    },
    correctIndex: {
      type: Number,
      required: true,
      min: 0,
      max: 3,
    },
    explanation: {
      type: String,
      trim: true,
      maxlength: 1200,
      default: "",
    },
    selectedIndex: {
      type: Number,
      min: 0,
      max: 3,
      default: null,
    },
    isCorrect: {
      type: Boolean,
      default: false,
    },
    timeSpentMs: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  { _id: false }
);

const attemptSchema = new mongoose.Schema(
  {
    visitorId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 128,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },

    phoneNumber: {
      type: String,
      trim: true,
      match: /^[6-9]\d{9}$/,
    },

    subject: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "all",
      index: true,
    },

    questionIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "QuizQuestion",
        required: true,
      },
    ],

    subjects: [
      {
        type: String,
        trim: true,
        maxlength: 80,
      },
    ],

    categories: [
      {
        type: String,
        trim: true,
        maxlength: 80,
      },
    ],

    attemptedCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    answers: {
      type: [answerSchema],
      default: [],
    },

    score: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalQuestions: {
      type: Number,
      required: true,
      min: 1,
    },

    correctCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    wrongCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    skippedCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    percentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    timeTakenMs: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Admin-defined quiz duration snapshot
    durationMinutes: {
      type: Number,
      required: true,
      min: 1,
      max: 180,
    },

    // Server-enforced expiry time
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },

    dateKey: {
      type: String,
      required: true,
      index: true,
    },

    quizDate: {
      type: Date,
      required: true,
      index: true,
    },

    attemptNumber: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },

    startedAt: {
      type: Date,
      default: Date.now,
    },

    submittedAt: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ["in_progress", "completed", "expired"],
      default: "in_progress",
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "quiz_attempts",
  }
);

attemptSchema.index({
  dateKey: 1,
  status: 1,
  percentage: -1,
});

attemptSchema.index({
  visitorId: 1,
  dateKey: 1,
  subject: 1,
  attemptNumber: 1,
}, { unique: true });

attemptSchema.index({
  dateKey: 1,
  subjects: 1,
  status: 1,
});

attemptSchema.index({
  expiresAt: 1,
  status: 1,
});

module.exports =
  mongoose.models.QuizAttempt ||
  mongoose.model("QuizAttempt", attemptSchema);