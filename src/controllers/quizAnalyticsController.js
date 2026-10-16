const { z } = require("zod");
const mongoose = require("mongoose");
const QuizAttempt = require("../models/QuizAttempt");
const QuizDailyParticipation = require("../models/QuizDailyParticipation");
const QuizPageVisit = require("../models/QuizPageVisit");
const QuizQuestion = require("../models/QuizQuestion");
const QuizCategory = require("../models/QuizCategory");
const PageView = require("../models/PageView");
const Visitor = require("../models/Visitor");
const { toDateKey, isDateKey } = require("../utils/quizDate");
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getDefaultRange = () => {
  const end = toDateKey();
  const date = new Date(`${end}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 6);
  return { from: date.toISOString().slice(0, 10), to: end };
};

const listDateKeys = (from, to) => {
  const dates = [];
  const cursor = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
};

const getQuizAnalytics = async (req, res) => {
  const defaults = getDefaultRange();
  const schema = z.object({
    from: z.string().trim().optional().default(defaults.from),
    to: z.string().trim().optional().default(defaults.to),
    subject: z.string().trim().max(80).optional().default(""),
    category: z.string().trim().max(80).optional().default(""),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  }).strict();
  const parsed = schema.safeParse(req.query);
  if (!parsed.success || !isDateKey(parsed.data?.from) || !isDateKey(parsed.data?.to)) {
    return res.status(400).json({ success: false, message: "Invalid analytics date range." });
  }

  const { from, to } = parsed.data;
  if (from > to) return res.status(400).json({ success: false, message: "The start date must be before the end date." });
  const dateKeys = listDateKeys(from, to);
  if (dateKeys.length > 366) return res.status(400).json({ success: false, message: "Date range cannot exceed 366 days." });

  const subject = parsed.data.subject;
  const category = parsed.data.category;
  const attemptMatch = { dateKey: { $gte: from, $lte: to } };
  if (subject) attemptMatch.subjects = subject;
  if (category) attemptMatch.categories = category;

  const [dailyTraffic, dailyQuizVisits, dailyQuiz, categoryRows, leaderboard, subjects, categories, scoreSummary, questionSummary, attempts, attemptsTotal] = await Promise.all([
    PageView.aggregate([
      { $match: { dateKey: { $gte: from, $lte: to } } },
      { $group: {
        _id: "$dateKey",
        allVisitorIds: { $addToSet: "$visitorId" },
        quizVisitorIds: { $addToSet: { $cond: [
          { $regexMatch: { input: "$path", regex: "^/quiz(?:/|$)" } },
          "$visitorId",
          null,
        ] } },
        quizPageViews: { $sum: { $cond: [{ $regexMatch: { input: "$path", regex: "^/quiz(?:/|$)" } }, 1, 0] } },
      } },
      { $project: {
        quizPageViews: 1,
        visitors: { $size: "$allVisitorIds" },
        legacyQuizVisitors: { $size: { $setDifference: ["$quizVisitorIds", [null]] } },
      } },
      { $sort: { _id: 1 } },
    ]),
    QuizPageVisit.aggregate([
      { $match: { dateKey: { $gte: from, $lte: to } } },
      { $group: { _id: "$dateKey", quizVisitors: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    QuizAttempt.aggregate([
      { $match: attemptMatch },
      { $group: {
        _id: "$dateKey",
        starts: { $sum: 1 },
        completions: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
        averageScore: { $avg: { $cond: [{ $eq: ["$status", "completed"] }, "$percentage", null] } },
        participants: { $addToSet: "$visitorId" },
      } },
      { $project: { starts: 1, completions: 1, averageScore: 1, quizParticipants: { $size: "$participants" } } },
      { $sort: { _id: 1 } },
    ]),
    QuizAttempt.aggregate([
      { $match: attemptMatch },
      { $lookup: {
        from: "quiz_questions",
        localField: "questionIds",
        foreignField: "_id",
        as: "questions",
      } },
      { $unwind: "$questions" },
      { $set: {
        answerForQuestion: { $first: {
          $filter: {
            input: "$answers",
            as: "answer",
            cond: { $eq: ["$$answer.questionId", "$questions._id"] },
          },
        } },
      } },
      ...(subject ? [{ $match: { "questions.subject": subject } }] : []),
      ...(category ? [{ $match: { "questions.category": category } }] : []),
      { $group: {
        _id: {
          category: "$questions.category",
          subject: { $ifNull: ["$questions.subject", "$questions.category"] },
        },
        attemptIds: { $addToSet: "$_id" },
        completedAttemptIds: { $addToSet: { $cond: [{ $eq: ["$status", "completed"] }, "$_id", null] } },
        visitors: { $addToSet: "$visitorId" },
        totalQuestions: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
        attemptedQuestions: { $sum: { $cond: [
          { $and: [{ $eq: ["$status", "completed"] }, { $ne: ["$answerForQuestion.selectedIndex", null] }] },
          1,
          0,
        ] } },
        correctAnswers: { $sum: { $cond: [
          { $and: [{ $eq: ["$status", "completed"] }, { $eq: ["$answerForQuestion.isCorrect", true] }] },
          1,
          0,
        ] } },
        wrongAnswers: { $sum: { $cond: [
          { $and: [{ $eq: ["$status", "completed"] }, { $ne: ["$answerForQuestion.selectedIndex", null] }, { $eq: ["$answerForQuestion.isCorrect", false] }] },
          1,
          0,
        ] } },
        skippedAnswers: { $sum: { $cond: [
          { $and: [{ $eq: ["$status", "completed"] }, { $eq: ["$answerForQuestion.selectedIndex", null] }] },
          1,
          0,
        ] } },
      } },
      { $project: {
        category: "$_id.category",
        subject: "$_id.subject",
        _id: 0,
        totalQuestions: 1,
        attemptedQuestions: 1,
        correctAnswers: 1,
        wrongAnswers: 1,
        skippedAnswers: 1,
        attempts: { $size: "$attemptIds" },
        completedAttempts: { $size: { $setDifference: ["$completedAttemptIds", [null]] } },
        visitors: { $size: "$visitors" },
        accuracy: { $cond: [{ $gt: ["$attemptedQuestions", 0] }, { $multiply: [{ $divide: ["$correctAnswers", "$attemptedQuestions"] }, 100] }, 0] },
      } },
      { $sort: { attempts: -1, category: 1, subject: 1 } },
    ]),
    QuizAttempt.find({ ...attemptMatch, status: "completed" })
      .select("name score totalQuestions percentage submittedAt")
      .sort({ percentage: -1, score: -1, timeTakenMs: 1, submittedAt: 1 })
      .limit(10)
      .lean(),
    QuizQuestion.distinct("subject", { active: true }),
    QuizCategory.find({ active: true }).distinct("name"),
    QuizAttempt.aggregate([
      { $match: { ...attemptMatch, status: "completed" } },
      { $group: { _id: null, averageScore: { $avg: "$percentage" } } },
    ]),
    QuizAttempt.aggregate([
      { $match: attemptMatch },
      { $group: {
        _id: null,
        attemptedQuestions: { $sum: "$attemptedCount" },
        skippedQuestions: { $sum: { $cond: [
          { $eq: ["$status", "completed"] },
          "$skippedCount",
          0,
        ] } },
      } },
    ]),
    QuizAttempt.find(attemptMatch)
      .select("name phoneNumber visitorId dateKey categories subjects attemptedCount correctCount wrongCount skippedCount totalQuestions percentage status startedAt submittedAt")
      .sort({ startedAt: -1 })
      .skip((parsed.data.page - 1) * parsed.data.limit)
      .limit(parsed.data.limit)
      .lean(),
    QuizAttempt.countDocuments(attemptMatch),
  ]);

  const trafficByDate = new Map(dailyTraffic.map((entry) => [entry._id, entry]));
  const quizVisitsByDate = new Map(dailyQuizVisits.map((entry) => [entry._id, entry]));
  const quizByDate = new Map(dailyQuiz.map((entry) => [entry._id, entry]));
  const dailyStats = dateKeys.map((dateKey) => {
    const traffic = trafficByDate.get(dateKey) || {};
    const quizVisits = quizVisitsByDate.get(dateKey) || {};
    const quiz = quizByDate.get(dateKey) || {};
    return {
      dateKey,
      visitors: traffic.visitors || 0,
      quizVisitors: quizVisits.quizVisitors ?? traffic.legacyQuizVisitors ?? 0,
      quizPageViews: traffic.quizPageViews || 0,
      attempts: quiz.starts || 0,
      quizStarts: quiz.starts || 0,
      completedAttempts: quiz.completions || 0,
      quizParticipants: quiz.quizParticipants || 0,
      averageScore: Number((quiz.averageScore || 0).toFixed(1)),
    };
  });

  const totalStarts = dailyStats.reduce((sum, entry) => sum + entry.attempts, 0);
  const totalCompletions = dailyStats.reduce((sum, entry) => sum + entry.completedAttempts, 0);
  const totalVisitors = dailyStats.reduce((sum, entry) => sum + entry.visitors, 0);
  const quizVisitors = dailyStats.reduce((sum, entry) => sum + entry.quizVisitors, 0);
  const quizPageViews = dailyStats.reduce((sum, entry) => sum + entry.quizPageViews, 0);
  const averageScore = Number((scoreSummary[0]?.averageScore || 0).toFixed(1));

  return res.status(200).json({
    success: true,
    data: {
      range: { from, to, subject, category },
      summary: {
        visitors: totalVisitors,
        quizVisitors,
        quizPageViews,
        quizStarts: totalStarts,
        completedAttempts: totalCompletions,
        completionRate: totalStarts ? Number(((totalCompletions / totalStarts) * 100).toFixed(1)) : 0,
        averageScore,
        attemptedQuestions: questionSummary[0]?.attemptedQuestions || 0,
        skippedQuestions: questionSummary[0]?.skippedQuestions || 0,
      },
      subjects: subjects.filter(Boolean).sort(),
      categories: categories.filter(Boolean).sort(),
      dailyStats,
      subjectStats: categoryRows.map((entry) => ({ ...entry, accuracy: Number(entry.accuracy.toFixed(1)) })),
      attempts: attempts.map((entry) => ({
        _id: entry._id,
        name: entry.name,
        phoneNumber: entry.phoneNumber || "",
        visitorId: entry.visitorId,
        dateKey: entry.dateKey,
        categories: entry.categories || [],
        subjects: entry.subjects || [],
        attemptedCount: entry.attemptedCount || 0,
        correctCount: entry.correctCount || 0,
        wrongCount: entry.wrongCount || 0,
        skippedCount: entry.status === "completed" ? entry.skippedCount || 0 : null,
        pendingCount: entry.status === "completed" ? 0 : Math.max(0, entry.totalQuestions - (entry.attemptedCount || 0)),
        totalQuestions: entry.totalQuestions,
        percentage: entry.percentage || 0,
        status: entry.status,
        startedAt: entry.startedAt,
        submittedAt: entry.submittedAt,
      })),
      attemptsPagination: {
        page: parsed.data.page,
        limit: parsed.data.limit,
        total: attemptsTotal,
        pages: Math.ceil(attemptsTotal / parsed.data.limit),
      },
      leaderboard: leaderboard.map((entry) => ({
        _id: entry._id,
        name: entry.name,
        score: entry.score,
        totalQuestions: entry.totalQuestions,
        percentage: entry.percentage,
        submittedAt: entry.submittedAt,
      })),
    },
  });
};

const parseTrafficRange = (req, res) => {
  const defaults = getDefaultRange();
  const schema = z.object({
    from: z.string().trim().optional().default(defaults.from),
    to: z.string().trim().optional().default(defaults.to),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    search: z.string().trim().max(128).optional().default(""),
    routePath: z.string().trim().max(250).optional().default(""),
  }).strict();
  const parsed = schema.safeParse(req.query);

  if (!parsed.success || !isDateKey(parsed.data?.from) || !isDateKey(parsed.data?.to)) {
    res.status(400).json({ success: false, message: "Invalid analytics date range." });
    return null;
  }

  const { from, to } = parsed.data;
  if (from > to) {
    res.status(400).json({ success: false, message: "The start date must be before the end date." });
    return null;
  }

  const dateKeys = listDateKeys(from, to);
  if (dateKeys.length > 366) {
    res.status(400).json({ success: false, message: "Date range cannot exceed 366 days." });
    return null;
  }

  return parsed.data;
};

const getQuizPageViewAnalytics = async (req, res) => {
  const filters = parseTrafficRange(req, res);
  if (!filters) return;

  const { from, to, page, limit, search, routePath } = filters;
  if (routePath && !/^\/quiz(?:\/|$)/.test(routePath)) {
    res.status(400).json({ success: false, message: "Select a valid quiz page route." });
    return;
  }
  const match = {
    dateKey: { $gte: from, $lte: to },
    path: /^\/quiz(?:\/|$)/,
  };
  if (routePath) match.path = routePath;
  if (search) {
    const searchRegex = new RegExp(escapeRegex(search), "i");
    match.$or = [
      { path: searchRegex },
      { visitorId: searchRegex },
      { source: searchRegex },
      { device: searchRegex },
      { referrer: searchRegex },
    ];
  }

  const [dailyStats, summaryRows, topPages, pageViews, total] = await Promise.all([
    PageView.aggregate([
      { $match: { dateKey: { $gte: from, $lte: to }, path: /^\/quiz(?:\/|$)/ } },
      { $group: { _id: "$dateKey", views: { $sum: 1 }, visitors: { $addToSet: "$visitorId" } } },
      { $project: { _id: 0, dateKey: "$_id", views: 1, visitors: { $size: "$visitors" } } },
      { $sort: { dateKey: 1 } },
    ]),
    PageView.aggregate([
      { $match: match },
      { $group: { _id: null, views: { $sum: 1 }, visitors: { $addToSet: "$visitorId" } } },
      { $project: { _id: 0, views: 1, visitors: { $size: "$visitors" } } },
    ]),
    PageView.aggregate([
      { $match: { dateKey: { $gte: from, $lte: to }, path: /^\/quiz(?:\/|$)/ } },
      { $group: { _id: "$path", views: { $sum: 1 }, visitors: { $addToSet: "$visitorId" } } },
      { $project: { _id: 0, path: "$_id", views: 1, visitors: { $size: "$visitors" } } },
      { $sort: { views: -1, path: 1 } },
      { $limit: 10 },
    ]),
    PageView.find(match)
      .select("visitorId dateKey path referrer device source createdAt")
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    PageView.countDocuments(match),
  ]);

  return res.status(200).json({
    success: true,
    data: {
      range: { from, to, search },
      summary: summaryRows[0] || { views: 0, visitors: 0 },
      dailyStats,
      topPages,
      pageViews,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  });
};

const getVisitorAnalytics = async (req, res) => {
  const filters = parseTrafficRange(req, res);
  if (!filters) return;

  const { from, to, page, limit, search, routePath } = filters;
  if (routePath && !/^\/(?!\/)[^?#]{0,249}$/.test(routePath)) {
    res.status(400).json({
      success: false,
      message: "Enter a valid page path beginning with /, such as /about.",
    });
    return;
  }
  const match = { dateKey: { $gte: from, $lte: to } };
  if (routePath) match.path = routePath;
  const pipeline = [
    { $match: match },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: "$visitorId",
        pageViews: { $sum: 1 },
        quizPageViews: { $sum: { $cond: [{ $regexMatch: { input: "$path", regex: "^/quiz(?:/|$)" } }, 1, 0] } },
        firstSeenAt: { $min: "$createdAt" },
        lastSeenAt: { $max: "$createdAt" },
        lastPage: { $first: "$path" },
        paths: { $addToSet: "$path" },
      },
    },
    {
      $lookup: {
        from: "visitors",
        localField: "_id",
        foreignField: "visitorId",
        as: "visitor",
      },
    },
    { $unwind: { path: "$visitor", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "quiz_attempts",
        let: { visitorId: "$_id" },
        pipeline: [
          { $match: { dateKey: { $gte: from, $lte: to }, $expr: { $eq: ["$visitorId", "$$visitorId"] } } },
          { $group: { _id: null, attempts: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } } } },
        ],
        as: "quiz",
      },
    },
    {
      $set: {
        quizAttempts: { $ifNull: [{ $first: "$quiz.attempts" }, 0] },
        completedAttempts: { $ifNull: [{ $first: "$quiz.completed" }, 0] },
      },
    },
  ];

  if (search) {
    const searchRegex = new RegExp(escapeRegex(search), "i");
    pipeline.push({
      $match: {
        $or: [
          { _id: searchRegex },
          { "visitor.name": searchRegex },
          { "visitor.phoneNumber": searchRegex },
          { "visitor.source": searchRegex },
          { "visitor.device": searchRegex },
          { "visitor.browser": searchRegex },
          { "visitor.city": searchRegex },
          { "visitor.country": searchRegex },
        ],
      },
    });
  }

  const [dailyStats, summaryRows, topPages, totalRows, visitorRows, routeVisitorIds] = await Promise.all([
    PageView.aggregate([
      { $match: match },
      { $group: { _id: "$dateKey", views: { $sum: 1 }, visitors: { $addToSet: "$visitorId" } } },
      { $project: { _id: 0, dateKey: "$_id", views: 1, visitors: { $size: "$visitors" } } },
      { $sort: { dateKey: 1 } },
    ]),
    PageView.aggregate([
      { $match: match },
      { $group: { _id: null, pageViews: { $sum: 1 }, visitors: { $addToSet: "$visitorId" } } },
      { $project: { _id: 0, pageViews: 1, visitors: { $size: "$visitors" } } },
    ]),
    PageView.aggregate([
      { $match: { dateKey: { $gte: from, $lte: to } } },
      { $group: { _id: "$path", views: { $sum: 1 }, visitors: { $addToSet: "$visitorId" } } },
      { $project: { _id: 0, path: "$_id", views: 1, visitors: { $size: "$visitors" } } },
      { $sort: { views: -1, path: 1 } },
      { $limit: 50 },
    ]),
    PageView.aggregate([...pipeline, { $count: "total" }]),
    PageView.aggregate([
      ...pipeline,
      { $sort: { lastSeenAt: -1, _id: 1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          visitorId: "$_id",
          name: { $ifNull: ["$visitor.name", ""] },
          phoneNumber: { $ifNull: ["$visitor.phoneNumber", ""] },
          pageViews: 1,
          quizPageViews: 1,
          quizAttempts: 1,
          completedAttempts: 1,
          firstSeenAt: 1,
          lastSeenAt: 1,
          lastPage: 1,
          paths: 1,
          device: { $ifNull: ["$visitor.device", "unknown"] },
          browser: { $ifNull: ["$visitor.browser", ""] },
          source: { $ifNull: ["$visitor.source", "direct"] },
          city: { $ifNull: ["$visitor.city", ""] },
          country: { $ifNull: ["$visitor.country", ""] },
        },
      },
    ]),
    routePath
      ? PageView.distinct("visitorId", match)
      : Promise.resolve([]),
  ]);

  const total = totalRows[0]?.total || 0;
  const quizAttemptMatch = { dateKey: { $gte: from, $lte: to } };
  if (routePath) quizAttemptMatch.visitorId = { $in: routeVisitorIds };
  const allQuizAttempts = await QuizAttempt.countDocuments(quizAttemptMatch);

  return res.status(200).json({
    success: true,
    data: {
      range: { from, to, search, routePath },
      summary: {
        ...(summaryRows[0] || { pageViews: 0, visitors: 0 }),
        quizAttempts: allQuizAttempts,
      },
      dailyStats,
      topPages,
      visitors: visitorRows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  });
};

const clearAnalyticsHistory = async (_req, res) => {
  const deletionResults = await Promise.allSettled([
    PageView.deleteMany({}),
    Visitor.deleteMany({}),
    QuizAttempt.deleteMany({}),
    QuizDailyParticipation.deleteMany({}),
    QuizPageVisit.deleteMany({}),
  ]);
  const failedDeletion = deletionResults.find(
    (result) => result.status === "rejected"
  );

  if (failedDeletion) {
    const error = new Error(
      "Analytics history deletion was incomplete. Check database collection counts before retrying."
    );
    error.statusCode = 500;
    throw error;
  }

  const [
    pageViews,
    visitors,
    quizAttempts,
    quizParticipations,
    quizPageVisits,
  ] = deletionResults.map((result) => result.value);

  return res.status(200).json({
    success: true,
    message: "All website and quiz analytics history has been deleted.",
    data: {
      deletedPageViews: pageViews.deletedCount || 0,
      deletedVisitors: visitors.deletedCount || 0,
      deletedQuizAttempts: quizAttempts.deletedCount || 0,
      deletedQuizParticipations: quizParticipations.deletedCount || 0,
      deletedQuizPageVisits: quizPageVisits.deletedCount || 0,
    },
  });
};

const getQuizAttemptDetails = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.attemptId)) {
    return res.status(400).json({ success: false, message: "Invalid quiz attempt ID." });
  }

  const attempt = await QuizAttempt.findById(req.params.attemptId).lean();
  if (!attempt) return res.status(404).json({ success: false, message: "Quiz attempt not found." });

  const questions = await QuizQuestion.find({ _id: { $in: attempt.questionIds } })
    .select("text options correctIndex explanation category subject")
    .lean();
  const questionById = new Map(questions.map((question) => [String(question._id), question]));
  const answersByQuestion = new Map((attempt.answers || []).map((answer) => [String(answer.questionId), answer]));
  const answers = attempt.questionIds.map((questionId) => {
    const question = questionById.get(String(questionId));
    if (!question) return null;

    const savedAnswer = answersByQuestion.get(String(questionId));
    const selectedIndex = savedAnswer?.selectedIndex ?? null;
    return {
      questionId: String(questionId),
      question: question.text?.en || "",
      questionHi: question.text?.hi || "",
      category: question.category,
      subject: question.subject || question.category,
      options: question.options,
      selectedIndex,
      correctIndex: question.correctIndex,
      isCorrect: selectedIndex !== null && selectedIndex === question.correctIndex,
      explanation: question.explanation,
    };
  }).filter(Boolean);

  return res.status(200).json({
    success: true,
    data: {
      _id: String(attempt._id),
      name: attempt.name,
      phoneNumber: attempt.phoneNumber || "",
      dateKey: attempt.dateKey,
      status: attempt.status,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      timeTakenMs: attempt.timeTakenMs,
      answers,
    },
  });
};

const deleteQuizVisitor = async (req, res) => {
  const visitorId = String(req.params.visitorId || "").trim();
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(visitorId)) {
    return res.status(400).json({ success: false, message: "Invalid quiz visitor ID." });
  }

  const [attemptsResult, participationResult, pageVisitsResult] = await Promise.all([
    QuizAttempt.deleteMany({ visitorId }),
    QuizDailyParticipation.deleteMany({ visitorId }),
    QuizPageVisit.deleteMany({ visitorId }),
    Visitor.updateOne({ visitorId }, { $unset: { quizLastCountedAt: "" } }),
  ]);

  return res.status(200).json({
    success: true,
    message: "Quiz visitor and their quiz records were deleted.",
    data: {
      deletedAttempts: attemptsResult.deletedCount || 0,
      deletedDailyParticipations: participationResult.deletedCount || 0,
      deletedQuizPageVisits: pageVisitsResult.deletedCount || 0,
    },
  });
};

module.exports = {
  getQuizAnalytics,
  getQuizPageViewAnalytics,
  getVisitorAnalytics,
  clearAnalyticsHistory,
  getQuizAttemptDetails,
  deleteQuizVisitor,
};
