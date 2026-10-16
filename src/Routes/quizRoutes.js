const express = require("express");
const multer = require("multer");

const {
  startQuiz,
  saveQuizAnswer,
  submitQuizAttempt,
  getLeaderboard,
  getDailyQuizStats,
  // getQuizArchive,
  // getQuizArchiveWithPagination,
  // getQuizArchiveDates,
  getQuizCategories,
  getQuizCategoryById,
  getPublicQuizCategories,
  createQuizCategory,
  updateQuizCategory,
  deleteQuizCategory,
  getQuizSetting,
  updateQuizSetting,
  getQuizQuestions,
  createQuestion,
  updateQuestion,
  importQuizQuestions,
  setQuizQuestionStatus,
  deleteQuizQuestion,
  deleteQuizQuestions,
} = require("../controllers/quizController");

const {
  getQuizAnalytics,
  getQuizPageViewAnalytics,
  getVisitorAnalytics,
  clearAnalyticsHistory,
  getQuizAttemptDetails,
  deleteQuizVisitor,
} = require("../controllers/quizAnalyticsController");

const asyncHandler = require("../utils/asyncHandler");
const authMiddleware = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");
const rateLimit = require("../middleware/rateLimit");
const csrfMiddleware = require("../middleware/csrfMiddleware");

const router = express.Router();

const publicQuizLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: "Too many quiz requests. Please try again later.",
});

const answerSaveLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 1000,
  message: "Too many answer updates. Please wait before trying again.",
});

const quizSubmitLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: "Too many quiz submissions. Please try again later.",
});

const quizWordUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    const isWordDocument =
      /\.docx$/i.test(file.originalname) &&
      [
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/octet-stream",
        "application/zip",
      ].includes(file.mimetype);

    callback(
      isWordDocument
        ? null
        : new Error("Upload a valid .docx Word document."),
      isWordDocument
    );
  },
});

/* Public quiz */

router.post(
  "/start",
  publicQuizLimit,
  asyncHandler(startQuiz)
);

router.put(
  "/:attemptId/answers",
  answerSaveLimit,
  asyncHandler(saveQuizAnswer)
);

router.post(
  "/:attemptId/submit",
  quizSubmitLimit,
  asyncHandler(submitQuizAttempt)
);

router.get(
  "/daily-stats",
  asyncHandler(getDailyQuizStats)
);

router.get(
  "/categories/public",
  asyncHandler(getPublicQuizCategories)
);

router.get(
  "/leaderboard",
  asyncHandler(getLeaderboard)
);

// Previous quiz archive APIs are temporarily disabled. Uncomment to restore.
// router.get("/archive/paginated", asyncHandler(getQuizArchiveWithPagination));
// router.get("/archive/dates", asyncHandler(getQuizArchiveDates));
// router.get("/archive/:date", asyncHandler(getQuizArchive));

/* Quiz settings */

router.get(
  "/settings",
  authMiddleware,
  authorize("superAdmin", "admin"),
  asyncHandler(getQuizSetting)
);

router.put(
  "/settings",
  authMiddleware,
  authorize("superAdmin", "admin"),
  csrfMiddleware,
  asyncHandler(updateQuizSetting)
);

/* Quiz categories */

router.get(
  "/categories",
  authMiddleware,
  authorize("superAdmin", "admin"),
  asyncHandler(getQuizCategories)
);

router.get(
  "/categories/:categoryId",
  authMiddleware,
  authorize("superAdmin", "admin"),
  asyncHandler(getQuizCategoryById)
);

router.post(
  "/categories",
  authMiddleware,
  authorize("superAdmin", "admin"),
  csrfMiddleware,
  asyncHandler(createQuizCategory)
);

router.patch(
  "/categories/:categoryId",
  authMiddleware,
  authorize("superAdmin", "admin"),
  csrfMiddleware,
  asyncHandler(updateQuizCategory)
);

router.delete(
  "/categories/:categoryId",
  authMiddleware,
  authorize("superAdmin", "admin"),
  csrfMiddleware,
  asyncHandler(deleteQuizCategory)
);

/* Quiz analytics */

router.get(
  "/analytics",
  authMiddleware,
  authorize("superAdmin", "admin"),
  asyncHandler(getQuizAnalytics)
);

router.get(
  "/analytics/page-views",
  authMiddleware,
  authorize("superAdmin", "admin"),
  asyncHandler(getQuizPageViewAnalytics)
);

router.get(
  "/analytics/visitors",
  authMiddleware,
  authorize("superAdmin", "admin"),
  asyncHandler(getVisitorAnalytics)
);

router.delete(
  "/analytics/history",
  authMiddleware,
  authorize("superAdmin"),
  csrfMiddleware,
  asyncHandler(clearAnalyticsHistory)
);

router.get(
  "/attempts/:attemptId",
  authMiddleware,
  authorize("superAdmin", "admin"),
  asyncHandler(getQuizAttemptDetails)
);

router.delete(
  "/visitors/:visitorId",
  authMiddleware,
  authorize("superAdmin", "admin"),
  csrfMiddleware,
  asyncHandler(deleteQuizVisitor)
);

/* Quiz questions */

router.get(
  "/questions",
  authMiddleware,
  authorize("superAdmin", "admin"),
  asyncHandler(getQuizQuestions)
);

router.post(
  "/questions/import-word",
  authMiddleware,
  authorize("superAdmin", "admin"),
  csrfMiddleware,
  quizWordUpload.single("file"),
  asyncHandler(importQuizQuestions)
);

router.post(
  "/questions",
  authMiddleware,
  authorize("superAdmin", "admin"),
  csrfMiddleware,
  asyncHandler(createQuestion)
);

router.put(
  "/questions/:questionId",
  authMiddleware,
  authorize("superAdmin", "admin"),
  csrfMiddleware,
  asyncHandler(updateQuestion)
);

router.patch(
  "/questions/:questionId",
  authMiddleware,
  authorize("superAdmin", "admin"),
  csrfMiddleware,
  asyncHandler(setQuizQuestionStatus)
);

router.delete(
  "/questions/:questionId",
  authMiddleware,
  authorize("superAdmin", "admin"),
  csrfMiddleware,
  asyncHandler(deleteQuizQuestion)
);

router.post(
  "/questions/bulk-delete",
  authMiddleware,
  authorize("superAdmin", "admin"),
  csrfMiddleware,
  asyncHandler(deleteQuizQuestions)
);

module.exports = router;