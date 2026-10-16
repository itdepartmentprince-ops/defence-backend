const quizService = require("../services/quizService");

const startQuiz = async (req, res) => {
  const result = await quizService.startQuiz({
    visitorId: req.body.visitorId,
    name: req.body.name,
    phoneNumber: req.body.phoneNumber,
    subject: req.body.subject,
    dateKey: req.body.dateKey,
  });

  if (result.validationError) {
    return res.status(400).json({
      success: false,
      message: result.validationError,
    });
  }

  if (result.noQuestions) {
    return res.status(404).json({
      success: false,
      message: "No quiz questions are available for today.",
    });
  }

  if (result.quizInactive) {
    return res.status(403).json({
      success: false,
      message: "Today's quiz is currently inactive.",
      quizInactive: true,
    });
  }

  if (result.alreadyCompleted) {
    return res.status(409).json({
      success: false,
      message: "You have already completed today's quiz.",
      alreadyCompleted: true,
    });
  }

  if (result.expired) {
    return res.status(409).json({
      success: false,
      message: "Your quiz session has expired.",
      expired: true,
    });
  }

  if (result.resumed && result.attempt) {
    const payload = await quizService.buildStartResponse(
      result.attempt,
      true
    );

    return res.status(200).json(payload);
  }

  if (result.alreadyStarted) {
    return res.status(409).json({
      success: false,
      message: "Your quiz session has already been started.",
      alreadyStarted: true,
    });
  }

  if (!result.attempt) {
    return res.status(500).json({
      success: false,
      message: "Unable to start the quiz.",
    });
  }

  const payload = await quizService.buildStartResponse(
    result.attempt,
    false
  );

  return res.status(201).json(payload);
};

const saveQuizAnswer = async (req, res) => {
  const result = await quizService.saveQuizAnswer({
    attemptId: req.params.attemptId,
    visitorId: req.body.visitorId,
    questionId: req.body.questionId,
    selectedIndex: req.body.selected,
  });

  if (result.notFound) {
    return res.status(404).json({
      success: false,
      message: "Quiz attempt not found.",
    });
  }

  if (result.invalidQuestion) {
    return res.status(400).json({
      success: false,
      message: "This question does not belong to the quiz.",
    });
  }

  if (result.invalidSelection) {
    return res.status(400).json({
      success: false,
      message: "Selected answer is invalid.",
    });
  }

  if (result.questionNotFound) {
    return res.status(404).json({
      success: false,
      message: "Question not found.",
    });
  }

  if (result.expired) {
    return res.status(409).json({
      success: false,
      message: "Quiz time has expired.",
      expired: true,
    });
  }

  if (result.completed) {
    return res.status(409).json({
      success: false,
      message: "This quiz has already been submitted.",
      completed: true,
    });
  }

  return res.status(200).json({
    success: true,
    message: "Answer saved.",
  });
};

const submitQuizAttempt = async (req, res) => {
  const result = await quizService.submitQuizAttempt({
    attemptId: req.params.attemptId,
    visitorId: req.body.visitorId,
    timeTakenMs: req.body.timeTakenMs,
  });

  if (result.notFound) {
    return res.status(404).json({
      success: false,
      message: "Quiz attempt not found.",
    });
  }

  const attempt = result.attempt;

  const questionMap = new Map(
    result.questions.map((question) => [
      String(question._id),
      question,
    ])
  );

  const review = attempt.answers.map((answer) => {
    const question = questionMap.get(
      String(answer.questionId)
    );
    const questionEnglish =
      question?.text?.en ||
      answer.questionText ||
      answer.questionHi ||
      "This question is no longer available.";
    const options =
      answer.options?.length === 4
        ? answer.options
        : question?.options || [];
    const correctIndex =
      Number.isInteger(answer.correctIndex)
        ? answer.correctIndex
        : question?.correctIndex;

    return {
      questionId: String(answer.questionId),
      question: questionEnglish,
      questionEnglish,
      questionHi:
        answer.questionHi || question?.text?.hi || "",
      options,
      selectedIndex: answer.selectedIndex,
      correctIndex,
      isCorrect:
        answer.selectedIndex !== null &&
        answer.selectedIndex !== undefined &&
        correctIndex !== undefined
          ? answer.selectedIndex === correctIndex
          : answer.isCorrect,
      explanation:
        answer.explanation || question?.explanation || "",
      category:
        answer.category || question?.category || "General",
      subject:
        answer.subject ||
        question?.subject ||
        question?.category ||
        "General Knowledge",
    };
  });

  return res.status(200).json({
    success: true,
    alreadyFinalized: Boolean(result.alreadyFinalized),
    expired: attempt.status === "expired",
    result: {
      attemptId: String(attempt._id),
      name: attempt.name,
      score: attempt.score,
      totalQuestions: attempt.totalQuestions,
      correctCount: attempt.correctCount,
      wrongCount: attempt.wrongCount,
      skippedCount: attempt.skippedCount,
      attemptedCount: attempt.attemptedCount,
      percentage: attempt.percentage,
      timeTakenMs: attempt.timeTakenMs,
      durationMinutes: attempt.durationMinutes,
      status: attempt.status,
      submittedAt: attempt.submittedAt,
      review,
    },
  });
};

const getLeaderboard = async (req, res) => {
  const leaderboard = await quizService.getLeaderboard(
    req.query.date
  );

  if (leaderboard === null) {
    return res.status(400).json({
      success: false,
      message: "Invalid date. Use YYYY-MM-DD.",
    });
  }

  return res.status(200).json({
    success: true,
    leaderboard,
  });
};

const getDailyQuizStats = async (req, res) => {
  const result = await quizService.getDailyQuizStats(
    req.query.date
  );

  return res.status(200).json({
    success: true,
    ...result,
  });
};

const getQuizArchive = async (req, res) => {
  const questions = await quizService.getQuizArchive(
    req.params.date
  );

  if (questions === null) {
    return res.status(400).json({
      success: false,
      message: "Invalid date. Use YYYY-MM-DD.",
    });
  }

  return res.status(200).json({
    success: true,
    date: req.params.date,
    questions,
  });
};

const getQuizArchiveWithPagination = async (req, res) => {
  const result =
    await quizService.getQuizArchiveWithPagination({
      dateKey: req.query.date,
      page: req.query.page,
      limit: req.query.limit,
    });

  if (result === null) {
    return res.status(400).json({
      success: false,
      message: "Invalid date. Use YYYY-MM-DD.",
    });
  }

  return res.status(200).json({
    success: true,
    ...result,
  });
};

const getQuizArchiveDates = async (req, res) => {
  const result = await quizService.getQuizArchiveDates({
    page: req.query.page,
    limit: req.query.limit,
  });

  return res.status(200).json({
    success: true,
    ...result,
  });
};

const getQuizCategories = async (req, res) => {
  const categories = await quizService.getQuizCategories();

  return res.status(200).json({
    success: true,
    categories,
  });
};

const getQuizCategoryById = async (req, res) => {
  const category = await quizService.getQuizCategoryById(req.params.categoryId);

  if (!category) {
    return res.status(404).json({ success: false, message: "Quiz category not found." });
  }

  return res.status(200).json({ success: true, category });
};

const getPublicQuizCategories = async (req, res) => {
  const result =
    await quizService.getPublicQuizCategories(
      req.query.date
    );

  return res.status(200).json({
    success: true,
    ...result,
  });
};

const createQuizCategory = async (req, res) => {
  const result = await quizService.createQuizCategory(
    req.body.name
  );

  if (result?.duplicate) {
    return res.status(409).json({
      success: false,
      message: "Quiz category already exists.",
    });
  }

  if (result?.validationError) {
    return res.status(400).json({ success: false, message: result.validationError });
  }

  return res.status(201).json({
    success: true,
    message: "Quiz category created successfully.",
    category: result,
  });
};

const updateQuizCategory = async (req, res) => {
  const result = await quizService.updateQuizCategory(req.params.categoryId, req.body);

  if (result?.invalidId) {
    return res.status(400).json({ success: false, message: "Invalid category ID." });
  }

  if (result?.notFound) {
    return res.status(404).json({ success: false, message: "Quiz category not found." });
  }

  if (result?.duplicate) {
    return res.status(409).json({ success: false, message: "Quiz category already exists." });
  }

  if (result?.validationError) {
    return res.status(400).json({ success: false, message: result.validationError });
  }

  return res.status(200).json({ success: true, message: "Quiz category updated successfully.", category: result });
};

const deleteQuizCategory = async (req, res) => {
  const result = await quizService.deleteQuizCategory(
    req.params.categoryId
  );

  if (result.invalidId) {
    return res.status(400).json({
      success: false,
      message: "Invalid category ID.",
    });
  }

  if (result.notFound) {
    return res.status(404).json({
      success: false,
      message: "Quiz category not found.",
    });
  }

  if (result.usedByQuestion) {
    return res.status(409).json({
      success: false,
      message: `Cannot delete this category: the connected quiz database found ${result.questionCount} question(s) across all dates (${result.activeQuestionCount} active, ${result.questionCount - result.activeQuestionCount} inactive). The question bank defaults to today's date; clear its date filter to find older or future questions.`,
      questionCount: result.questionCount,
      activeQuestionCount: result.activeQuestionCount,
    });
  }

  return res.status(200).json({
    success: true,
    message: "Quiz category deleted successfully.",
  });
};

const getQuizSetting = async (req, res) => {
  const setting = await quizService.getQuizSetting(
    req.query.date
  );

  return res.status(200).json({
    success: true,
    setting,
  });
};

const updateQuizSetting = async (req, res) => {
  const setting = await quizService.upsertQuizSetting({
    dateKey: req.body.dateKey,
    durationMinutes: req.body.durationMinutes,
    isActive: req.body.isActive,
  });

  if (!setting) {
    return res.status(400).json({
      success: false,
      message:
        "Invalid date or duration. Duration must be between 1 and 180 minutes.",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Quiz setting updated successfully.",
    setting,
  });
};

const getQuizQuestions = async (req, res) => {
  const result = await quizService.getQuizQuestions({
    category: req.query.category,
    subject: req.query.subject,
    dateKey: req.query.date,
    search: req.query.search,
    page: req.query.page,
    limit: req.query.limit,
  });

  if (result === null) {
    return res.status(400).json({
      success: false,
      message: "Invalid date. Use YYYY-MM-DD.",
    });
  }

  return res.status(200).json({
    success: true,
    ...result,
  });
};

const createQuestion = async (req, res) => {
  const result = await quizService.createQuestion(
    req.body
  );

  if (result === null) {
    return res.status(400).json({
      success: false,
      message: "Invalid scheduled date.",
    });
  }

  if (result.categoryInactive) {
    return res.status(400).json({
      success: false,
      message:
        "Selected category does not exist or is inactive.",
    });
  }

  return res.status(201).json({
    success: true,
    message: "Quiz question created successfully.",
    data: result,
  });
};

const updateQuestion = async (req, res) => {
  const result = await quizService.updateQuizQuestion(
    req.params.questionId,
    req.body
  );

  if (result.invalidId) {
    return res.status(400).json({
      success: false,
      message: "Invalid question ID.",
    });
  }

  if (result.notFound) {
    return res.status(404).json({
      success: false,
      message: "Quiz question not found.",
    });
  }

  if (result.invalidDate) {
    return res.status(400).json({
      success: false,
      message: "Invalid scheduled date.",
    });
  }

  if (result.categoryInactive) {
    return res.status(400).json({
      success: false,
      message:
        "Selected category does not exist or is inactive.",
    });
  }

  if (result.historyProtected) {
    return res.status(409).json({
      success: false,
      message:
        "Question cannot be edited because it has already been used by a quiz attempt.",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Quiz question updated successfully.",
    data: result,
  });
};

const importQuizQuestions = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "Please upload a .docx Word file.",
    });
  }

  const result =
    await quizService.importQuizQuestions(
      req.file.buffer,
      req.body.durationMinutes
    );

  return res.status(201).json({
    success: true,
    message:
      "Quiz questions imported successfully.",
    importedCount: result.importedCount,
    scheduledDate: result.scheduledDate,
  });
};

const setQuizQuestionStatus = async (req, res) => {
  const question =
    await quizService.setQuizQuestionStatus(
      req.params.questionId,
      req.body.active
    );

  if (question === null) {
    return res.status(404).json({
      success: false,
      message: "Quiz question not found.",
    });
  }

  return res.status(200).json({
    success: true,
    message:
      "Quiz question status updated successfully.",
    question,
  });
};

const deleteQuizQuestion = async (req, res) => {
  const result =
    await quizService.deleteQuizQuestion(
      req.params.questionId
    );

  if (result.invalidId) {
    return res.status(400).json({
      success: false,
      message: "Invalid question ID.",
    });
  }

  if (result.notFound) {
    return res.status(404).json({
      success: false,
      message: "Quiz question not found.",
    });
  }

  if (result.futureQuestion) {
    return res.status(403).json({
      success: false,
      message: "Future quiz questions cannot be deleted.",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Quiz question deleted successfully.",
  });
};

const deleteQuizQuestions = async (req, res) => {
  const result = await quizService.deleteQuizQuestions(
    req.body.questionIds
  );

  if (result.invalidIds) {
    return res.status(400).json({
      success: false,
      message: "Select between 1 and 500 valid quiz question IDs.",
    });
  }

  return res.status(200).json({
    success: true,
    message: `${result.deletedCount} quiz question(s) deleted. ${result.skippedCount} question(s) were kept because future-date questions cannot be deleted.`,
    ...result,
  });
};

module.exports = {
  startQuiz,
  saveQuizAnswer,
  submitQuizAttempt,
  getLeaderboard,
  getDailyQuizStats,
  getQuizArchive,
  getQuizArchiveWithPagination,
  getQuizArchiveDates,
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
};