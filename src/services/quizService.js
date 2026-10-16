
const crypto = require("node:crypto");
const mongoose = require("mongoose");

const QuizCategory = require("../models/QuizCategory");
const QuizQuestion = require("../models/QuizQuestion");
const QuizAttempt = require("../models/QuizAttempt");
const QuizDailyParticipation = require("../models/QuizDailyParticipation");
const QuizSetting = require("../models/QuizSetting");
const Visitor = require("../models/Visitor");

const parseQuizWordDocument = require("../utils/parseQuizWordDocument");

const {
  toDateKey,
  getIstDayRange,
  isDateKey,
} = require("../utils/quizDate");

const DEFAULT_DURATION_MINUTES = 15;
const MAX_DURATION_MINUTES = 180;
const MAX_QUESTIONS_PER_IMPORT = 500;

const getQuizSettingForDate = async (dateKey) => {
  return QuizSetting.findOne({
    dateKey,
  })
    .select("durationMinutes isActive")
    .lean();
};

const getQuizDuration = async (dateKey) => {
  const setting = await getQuizSettingForDate(dateKey);

  return (
    setting?.durationMinutes ||
    DEFAULT_DURATION_MINUTES
  );
};

const getQuestionPublicData = (question) => ({
  _id: String(question._id),
  text: question.text,
  options: question.options,
  category: question.category,
  subject: question.subject || question.category,
  difficulty: question.difficulty,
});

const getAttemptQuestions = async (attempt) => {
  const questions = await QuizQuestion.find({
    _id: {
      $in: attempt.questionIds,
    },
  }).lean();

  const questionMap = new Map(
    questions.map((question) => [
      String(question._id),
      question,
    ])
  );

  return attempt.questionIds
    .map((id) => questionMap.get(String(id)))
    .filter(Boolean);
};

const buildStartResponse = async (
  attempt,
  resumed = false
) => {
  const questions = await getAttemptQuestions(attempt);

  const answers = Object.fromEntries(
    (attempt.answers || []).map((answer) => [
      String(answer.questionId),
      answer.selectedIndex,
    ])
  );

  return {
    attemptId: String(attempt._id),
    visitorId: attempt.visitorId,
    name: attempt.name,
    subject: attempt.subject || "all",
    questions: questions.map(getQuestionPublicData),
    answers,
    resumed,
    durationMinutes: attempt.durationMinutes,
    expiresAt: attempt.expiresAt,
    startedAt: attempt.startedAt,
  };
};

const calculateAttemptResult = (attempt) => {
  const attemptedCount = attempt.answers.filter(
    (answer) =>
      answer.selectedIndex !== null &&
      answer.selectedIndex !== undefined
  ).length;

  const correctCount = attempt.answers.filter(
    (answer) => answer.isCorrect
  ).length;

  attempt.attemptedCount = attemptedCount;
  attempt.correctCount = correctCount;

  attempt.wrongCount = Math.max(
    0,
    attemptedCount - correctCount
  );

  attempt.skippedCount = Math.max(
    0,
    attempt.totalQuestions - attemptedCount
  );

  attempt.score = correctCount;

  attempt.percentage = Number(
    (
      (correctCount /
        Math.max(attempt.totalQuestions, 1)) *
      100
    ).toFixed(2)
  );
};

const ensureAttemptDuration = async (
  attempt,
  durationMinutes
) => {
  let changed = false;

  if (!attempt.durationMinutes) {
    attempt.durationMinutes = durationMinutes;
    changed = true;
  }

  if (!attempt.expiresAt) {
    attempt.expiresAt = new Date(
      new Date(attempt.startedAt).getTime() +
        attempt.durationMinutes * 60 * 1000
    );

    changed = true;
  }

  if (changed) {
    await attempt.save();
  }

  return attempt;
};

const expireAttempt = async (attempt) => {
  const questions = await getAttemptQuestions(attempt);

  const answerMap = new Map(
    (attempt.answers || []).map((answer) => [
      String(answer.questionId),
      answer,
    ])
  );

  attempt.answers = attempt.questionIds.map(
    (questionId) => {
      const existing = answerMap.get(
        String(questionId)
      );

      if (existing) {
        return existing;
      }

      const question = questions.find(
        (item) =>
          String(item._id) === String(questionId)
      );

      return {
        questionId,
        category: question?.category || "General",
        subject:
          question?.subject ||
          question?.category ||
          "General Knowledge",
        questionText:
          question?.text?.en ||
          question?.text?.hi ||
          "This question is no longer available.",
        questionHi: question?.text?.hi || "",
        options: question?.options || ["", "", "", ""],
        correctIndex: question?.correctIndex ?? 0,
        explanation: question?.explanation || "",
        selectedIndex: null,
        isCorrect: false,
      };
    }
  );

  calculateAttemptResult(attempt);

  attempt.timeTakenMs =
    attempt.durationMinutes * 60 * 1000;

  attempt.status = "expired";
  attempt.submittedAt = new Date();

  await attempt.save();

  await QuizDailyParticipation.updateOne(
    {
      visitorId: attempt.visitorId,
      dateKey: attempt.dateKey,
      attemptId: attempt._id,
    },
    {
      $set: {
        status: "completed",
      },
    }
  );

  return attempt;
};

const isAttemptExpired = (attempt) =>
  attempt.expiresAt &&
  Date.now() >=
    new Date(attempt.expiresAt).getTime();

const getExistingAttemptResult = async (
  attempt,
  durationMinutes,
  phoneNumber
) => {
  if (!attempt) {
    return null;
  }

  if (attempt.status === "in_progress") {
    await ensureAttemptDuration(
      attempt,
      durationMinutes
    );

    if (isAttemptExpired(attempt)) {
      await expireAttempt(attempt);

      return {
        expired: true,
        attempt,
      };
    }

    if (!attempt.phoneNumber && phoneNumber) {
      attempt.phoneNumber = phoneNumber;
      await attempt.save();
    }

    return {
      resumed: true,
      attempt,
    };
  }

  if (attempt.status === "completed") {
    return {
      alreadyCompleted: true,
      attempt,
    };
  }

  if (attempt.status === "expired") {
    return {
      expired: true,
      attempt,
    };
  }

  return null;
};

const upsertVisitor = async ({ visitorId, name, phoneNumber }) => {
  const cleanVisitorId = String(visitorId || "").trim();
  const cleanName = String(name || "").trim();
  const cleanPhoneNumber = String(phoneNumber || "").trim();

  if (!/^[A-Za-z0-9_-]{16,128}$/.test(cleanVisitorId)) {
    return { valid: false, message: "Invalid visitor ID." };
  }

  const existingVisitor = await Visitor.findOne({ visitorId: cleanVisitorId });
  if (existingVisitor) {
    if (cleanName && existingVisitor.name && existingVisitor.name !== cleanName) {
      return { valid: false, message: "Visitor identity does not match the saved details." };
    }

    if (cleanPhoneNumber && existingVisitor.phoneNumber && existingVisitor.phoneNumber !== cleanPhoneNumber) {
      return { valid: false, message: "Visitor identity does not match the saved mobile number." };
    }

    const resolvedName = cleanName || existingVisitor.name;
    const resolvedPhoneNumber = cleanPhoneNumber || existingVisitor.phoneNumber;
    if (resolvedName.length < 2 || resolvedName.length > 50) {
      return { valid: false, message: "Name must be between 2 and 50 characters." };
    }

    if (!/^[6-9]\d{9}$/.test(resolvedPhoneNumber)) {
      return { valid: false, message: "Enter a valid 10-digit mobile number." };
    }

    existingVisitor.name = resolvedName;
    existingVisitor.phoneNumber = resolvedPhoneNumber;
    existingVisitor.lastSeenAt = new Date();
    await existingVisitor.save();
    return { valid: true, visitor: existingVisitor };
  }

  if (cleanName.length < 2 || cleanName.length > 50) {
    return { valid: false, message: "Name must be between 2 and 50 characters." };
  }

  if (!/^[6-9]\d{9}$/.test(cleanPhoneNumber)) {
    return { valid: false, message: "Enter a valid 10-digit mobile number." };
  }

  const visitor = await Visitor.create({
    visitorId: cleanVisitorId,
    name: cleanName,
    phoneNumber: cleanPhoneNumber,
    firstSeenAt: new Date(),
    lastSeenAt: new Date(),
  });

  return { valid: true, visitor };
};

const startQuiz = async ({
  visitorId,
  name,
  phoneNumber,
  subject = "all",
  dateKey: requestedDateKey,
}) => {
  const dateKey = requestedDateKey || toDateKey();

  if (!isDateKey(dateKey)) {
    return { validationError: "A valid quiz date is required." };
  }

  const todayKey = toDateKey();
  if (dateKey > todayKey) {
    return { validationError: "Future quiz dates are not available." };
  }
  if (dateKey < todayKey) {
    return {
      validationError: "Previous quizzes are temporarily unavailable.",
    };
  }

  const normalizedSubject = String(subject || "all").trim();
  const visitorResult = await upsertVisitor({ visitorId, name, phoneNumber });

  if (!visitorResult.valid) {
    return { validationError: visitorResult.message };
  }

  const { visitor } = visitorResult;
  const cleanVisitorId = visitor.visitorId;
  const cleanName = visitor.name;
  const cleanPhoneNumber = visitor.phoneNumber;

  const {
    start: quizDate,
    end,
  } = getIstDayRange(dateKey);

  const setting =
    await getQuizSettingForDate(dateKey);

  const isToday = dateKey === todayKey;

  if (isToday && setting?.isActive === false) {
    return {
      quizInactive: true,
    };
  }

  const durationMinutes =
    setting?.durationMinutes ||
    DEFAULT_DURATION_MINUTES;
  let participation = null;

  if (isToday) {
    participation =
      await QuizDailyParticipation.findOne({
        visitorId: cleanVisitorId,
        dateKey,
        subject: normalizedSubject,
      });

  }

  if (participation?.attemptId) {
    const existingAttempt =
      await QuizAttempt.findById(
        participation.attemptId
      );

    const existingAttemptResult =
      await getExistingAttemptResult(
        existingAttempt,
        durationMinutes,
        cleanPhoneNumber
      );

    if (existingAttemptResult) {
      return existingAttemptResult;
    }
  }

  if (participation) {
    return {
      alreadyStarted: true,
      participation,
    };
  }

  if (!isToday) {
    const existingAttempt =
      await QuizAttempt.findOne({
        visitorId: cleanVisitorId,
        dateKey,
        subject: normalizedSubject,
      }).sort({
        attemptNumber: -1,
        startedAt: -1,
      });

    const existingAttemptResult =
      await getExistingAttemptResult(
        existingAttempt,
        durationMinutes,
        cleanPhoneNumber
      );

    if (
      existingAttemptResult &&
      !(existingAttemptResult.expired && !isToday)
    ) {
      return existingAttemptResult;
    }
  }

  const questionFilter = {
    active: true,
    scheduledDate: {
      $gte: quizDate,
      $lte: end,
    },
  };

  if (normalizedSubject !== "all") {
    questionFilter.subject = normalizedSubject;
  }

  const questions =
    await QuizQuestion.find(questionFilter)
      .sort({
        category: 1,
        subject: 1,
        createdAt: 1,
        _id: 1,
      })
      .lean();

  if (!questions.length) {
    return {
      noQuestions: true,
    };
  }

  let reservationToken = null;
  let newAttemptData = null;

  if (isToday) {
    reservationToken = crypto.randomUUID();

    try {
      participation =
        await QuizDailyParticipation.create({
          visitorId: cleanVisitorId,
          dateKey,
          name: cleanName,
          phoneNumber: cleanPhoneNumber,
          subject: normalizedSubject,
          status: "starting",
          reservationToken,
        });
    } catch (error) {
      if (error.code === 11000) {
        return {
          alreadyStarted: true,
          participation:
            await QuizDailyParticipation.findOne({
              visitorId: cleanVisitorId,
              dateKey,
              subject: normalizedSubject,
            }),
        };
      }

      throw error;
    }
  }

  try {
    const categories = [
      ...new Set(
        questions.map(
          (question) => question.category
        )
      ),
    ];

    const subjects = [
      ...new Set(
        questions.map(
          (question) =>
            question.subject ||
            question.category
        )
      ),
    ];

    const startedAt = new Date();

    const expiresAt = new Date(
      startedAt.getTime() +
        durationMinutes * 60 * 1000
    );

    const attemptNumber = isToday
      ? 1
      : (await QuizAttempt.countDocuments({
          visitorId: cleanVisitorId,
          dateKey,
        })) + 1;

    newAttemptData = {
      visitorId: cleanVisitorId,
      name: cleanName,
      phoneNumber: cleanPhoneNumber,
      subject: normalizedSubject,
      questionIds: questions.map(
        (question) => question._id
      ),
      categories,
      subjects: [normalizedSubject === "all" ? "All Subjects" : normalizedSubject],
      totalQuestions: questions.length,
      dateKey,
      quizDate,
      attemptNumber,
      durationMinutes,
      expiresAt,
      startedAt,
      status: "in_progress",
    };

    const attempt = await QuizAttempt.create(
      newAttemptData
    );

    if (reservationToken) {
      await QuizDailyParticipation.updateOne(
        {
          _id: participation._id,
          reservationToken,
        },
        {
          $set: {
            attemptId: attempt._id,
            status: "in_progress",
          },
        }
      );
    }

    return {
      created: true,
      attempt,
    };
  } catch (error) {
    if (reservationToken && participation) {
      await QuizDailyParticipation.deleteOne({
        _id: participation._id,
        reservationToken,
        status: "starting",
      });
    }

    if (error.code === 11000) {
      const existingAttempt =
        await QuizAttempt.findOne({
          visitorId: cleanVisitorId,
          dateKey,
          subject: normalizedSubject,
        }).sort({
          attemptNumber: -1,
          startedAt: -1,
        });

      if (
        !isToday &&
        existingAttempt?.status === "expired" &&
        error.keyPattern?.visitorId &&
        error.keyPattern?.dateKey &&
        !error.keyPattern?.attemptNumber &&
        newAttemptData
      ) {
        existingAttempt.set({
          ...newAttemptData,
          attemptNumber: existingAttempt.attemptNumber,
          attemptedCount: 0,
          answers: [],
          score: 0,
          correctCount: 0,
          wrongCount: 0,
          skippedCount: 0,
          percentage: 0,
          timeTakenMs: 0,
          submittedAt: null,
        });
        await existingAttempt.save();

        return {
          created: true,
          attempt: existingAttempt,
        };
      }

      const existingAttemptResult =
        await getExistingAttemptResult(
          existingAttempt,
          durationMinutes,
          cleanPhoneNumber
        );

      if (existingAttemptResult) {
        return existingAttemptResult;
      }
    }

    throw error;
  }
};

const saveQuizAnswer = async ({
  attemptId,
  visitorId,
  questionId,
  selectedIndex,
}) => {
  const attempt =
    await QuizAttempt.findOne({
      _id: attemptId,
      visitorId,
    });

  if (!attempt) {
    return {
      notFound: true,
    };
  }

  if (attempt.status === "completed") {
    return {
      completed: true,
      attempt,
    };
  }

  if (attempt.status === "expired") {
    return {
      expired: true,
      attempt,
    };
  }

  if (isAttemptExpired(attempt)) {
    await expireAttempt(attempt);

    return {
      expired: true,
      attempt,
    };
  }

  if (
    !attempt.questionIds.some(
      (id) =>
        String(id) === String(questionId)
    )
  ) {
    return {
      invalidQuestion: true,
    };
  }

  const normalizedSelectedIndex =
    Number(selectedIndex);

  if (
    !Number.isInteger(
      normalizedSelectedIndex
    ) ||
    normalizedSelectedIndex < 0 ||
    normalizedSelectedIndex > 3
  ) {
    return {
      invalidSelection: true,
    };
  }

  const question =
    await QuizQuestion.findById(
      questionId
    )
      .select(
        "text options correctIndex explanation category subject"
      )
      .lean();

  if (!question) {
    return {
      questionNotFound: true,
    };
  }

  const answer = {
    questionId: question._id,
    category: question.category,
    subject:
      question.subject ||
      question.category,
    questionText:
      question.text?.en ||
      question.text?.hi ||
      "",
    questionHi: question.text?.hi || "",
    options: question.options,
    correctIndex: Number(
      question.correctIndex
    ),
    explanation: question.explanation || "",
    selectedIndex:
      normalizedSelectedIndex,
    isCorrect:
      Number(question.correctIndex) ===
      normalizedSelectedIndex,
  };

  const existingIndex =
    attempt.answers.findIndex(
      (item) =>
        String(item.questionId) ===
        String(questionId)
    );

  if (existingIndex >= 0) {
    attempt.answers[existingIndex] =
      answer;
  } else {
    attempt.answers.push(answer);
  }

  calculateAttemptResult(attempt);

  await attempt.save();

  return {
    saved: true,
    attempt,
  };
};

const submitQuizAttempt = async ({
  attemptId,
  visitorId,
  timeTakenMs = 0,
}) => {
  const attempt =
    await QuizAttempt.findOne({
      _id: attemptId,
      visitorId,
    });

  if (!attempt) {
    return {
      notFound: true,
    };
  }

  const questions =
    await getAttemptQuestions(attempt);

  if (
    attempt.status === "completed" ||
    attempt.status === "expired"
  ) {
    return {
      alreadyFinalized: true,
      attempt,
      questions,
    };
  }

  const expired =
    isAttemptExpired(attempt);

  if (expired) {
    await expireAttempt(attempt);

    return {
      finalized: true,
      expired: true,
      attempt,
      questions,
    };
  }

  const answerMap = new Map(
    (attempt.answers || []).map(
      (answer) => [
        String(answer.questionId),
        answer,
      ]
    )
  );

  attempt.answers =
    attempt.questionIds.map(
      (questionId) => {
        const existing =
          answerMap.get(
            String(questionId)
          );

        if (existing) {
          return existing;
        }

        const question = questions.find(
          (item) =>
            String(item._id) ===
            String(questionId)
        );

        return {
          questionId,
          category:
            question?.category ||
            "General",
          subject:
            question?.subject ||
            question?.category ||
            "General Knowledge",
          questionText:
            question?.text?.en ||
            question?.text?.hi ||
            "This question is no longer available.",
          questionHi: question?.text?.hi || "",
          options: question?.options || ["", "", "", ""],
          correctIndex: question?.correctIndex ?? 0,
          explanation: question?.explanation || "",
          selectedIndex: null,
          isCorrect: false,
        };
      }
    );

  calculateAttemptResult(attempt);

  const serverElapsedMs = Math.min(
    Math.max(
      0,
      Date.now() -
        new Date(
          attempt.startedAt
        ).getTime()
    ),
    attempt.durationMinutes * 60 * 1000
  );

  attempt.timeTakenMs = serverElapsedMs;
  attempt.status = "completed";
  attempt.submittedAt = new Date();

  await attempt.save();

  await QuizDailyParticipation.updateOne(
    {
      visitorId: attempt.visitorId,
      dateKey: attempt.dateKey,
      attemptId: attempt._id,
    },
    {
      $set: {
        status: "completed",
      },
    }
  );

  return {
    finalized: true,
    attempt,
    questions,
  };
};

const getLeaderboard = async (
  dateKey = toDateKey()
) => {
  if (!isDateKey(dateKey)) {
    return null;
  }

  const attempts =
    await QuizAttempt.find({
      dateKey,
      status: "completed",
      percentage: { $gte: 70 },
    })
      .select("name percentage")
      .sort({
        percentage: -1,
        score: -1,
        timeTakenMs: 1,
        submittedAt: 1,
      })
      .limit(10)
      .lean();

  return attempts;
};

const getDailyQuizStats = async (
  dateKey = toDateKey()
) => {
  if (!isDateKey(dateKey)) {
    return null;
  }

  const {
    start,
    end,
  } = getIstDayRange(dateKey);

  const [
    categories,
    setting,
  ] = await Promise.all([
    QuizQuestion.aggregate([
      {
        $match: {
          active: true,
          scheduledDate: {
            $gte: start,
            $lte: end,
          },
        },
      },
      {
        $group: {
          _id: { $ifNull: ["$subject", "$category"] },
          questionCount: {
            $sum: 1,
          },
        },
      },
      {
        $project: {
          _id: 0,
          subject: "$_id",
          questionCount: 1,
        },
      },
      {
        $sort: {
          subject: 1,
        },
      },
    ]),
    getQuizSettingForDate(
      dateKey
    ),
  ]);

  return {
    date: dateKey,
    durationMinutes:
      setting?.durationMinutes ||
      DEFAULT_DURATION_MINUTES,
    isActive:
      setting?.isActive !== false,
    categories,
  };
};

const getQuizArchive = async (
  dateKey
) => {
  if (!isDateKey(dateKey)) {
    return null;
  }

  const {
    start,
    end,
  } = getIstDayRange(dateKey);

  const questions =
    await QuizQuestion.find({
      active: true,
      scheduledDate: {
        $gte: start,
        $lte: end,
      },
    })
      .select(
        "text options correctIndex explanation category subject difficulty"
      )
      .sort({
        category: 1,
        subject: 1,
        createdAt: 1,
      })
      .lean();

  return questions;
};

const getQuizArchiveWithPagination =
  async ({
    dateKey,
    page = 1,
    limit = 10,
  }) => {
    if (!isDateKey(dateKey)) {
      return null;
    }

    const pageNumber = Math.max(
      1,
      Number(page) || 1
    );

    const limitNumber = Math.min(
      50,
      Math.max(
        1,
        Number(limit) || 10
      )
    );

    const {
      start,
      end,
    } = getIstDayRange(dateKey);

    const filter = {
      active: true,
      scheduledDate: {
        $gte: start,
        $lte: end,
      },
    };

    const [
      questions,
      total,
    ] = await Promise.all([
      QuizQuestion.find(filter)
        .select(
          "text options correctIndex explanation category subject difficulty"
        )
        .sort({
          category: 1,
          subject: 1,
          createdAt: 1,
        })
        .skip(
          (pageNumber - 1) *
            limitNumber
        )
        .limit(limitNumber)
        .lean(),

      QuizQuestion.countDocuments(
        filter
      ),
    ]);

    const totalPages = Math.ceil(
      total / limitNumber
    );

    return {
      date: dateKey,
      questions,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages,
        hasNextPage:
          pageNumber < totalPages,
        hasPreviousPage:
          pageNumber > 1,
      },
    };
  };

const getQuizArchiveDates = async ({
  page = 1,
  limit = 10,
} = {}) => {
  const pageNumber = Math.max(1, Number(page) || 1);
  const limitNumber = Math.min(100, Math.max(1, Number(limit) || 10));
  const { start } = getIstDayRange(toDateKey());

  const [result] = await QuizQuestion.aggregate([
    {
      $match: {
        active: true,
        scheduledDate: { $lt: start },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: "$scheduledDate",
            timezone: "Asia/Kolkata",
          },
        },
        questionCount: { $sum: 1 },
      },
    },
    { $sort: { _id: -1 } },
    {
      $facet: {
        dates: [
          { $skip: (pageNumber - 1) * limitNumber },
          { $limit: limitNumber },
          { $project: { _id: 0, dateKey: "$_id", questionCount: 1 } },
        ],
        total: [{ $count: "count" }],
      },
    },
  ]);
  const total = result?.total?.[0]?.count || 0;

  return {
    dates: result?.dates || [],
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPages: Math.ceil(total / limitNumber),
    },
  };
};

const getQuizCategories = async () => {
  return QuizCategory.find({})
    .select("name normalizedName active")
    .sort({ name: 1 })
    .lean();
};

const getQuizCategoryById = async (categoryId) => {
  if (!mongoose.isValidObjectId(categoryId)) return null;
  return QuizCategory.findById(categoryId).lean();
};

const createQuizCategory = async (name) => {
  const cleanName = String(name || "").trim();
  if (cleanName.length < 2 || cleanName.length > 80) {
    return { validationError: "Category name must be between 2 and 80 characters." };
  }

  const normalizedName = cleanName.toLocaleLowerCase("en-IN");
  try {
    return await QuizCategory.create({ name: cleanName, normalizedName });
  } catch (error) {
    if (error.code === 11000) return { duplicate: true };
    throw error;
  }
};

const updateQuizCategory = async (categoryId, categoryData) => {
  if (!mongoose.isValidObjectId(categoryId)) return { invalidId: true };

  const category = await QuizCategory.findById(categoryId);
  if (!category) return { notFound: true };

  const name = String(categoryData?.name || category.name).trim();
  if (name.length < 2 || name.length > 80) {
    return { validationError: "Category name must be between 2 and 80 characters." };
  }

  const normalizedName = name.toLocaleLowerCase("en-IN");
  if (normalizedName !== category.normalizedName) {
    const duplicate = await QuizCategory.exists({ normalizedName, _id: { $ne: category._id } });
    if (duplicate) return { duplicate: true };
  }

  category.name = name;
  category.normalizedName = normalizedName;
  category.active = categoryData?.active !== false;
  await category.save();
  return category;
};

const getPublicQuizCategories = async (
  dateKey = toDateKey()
) => {
  if (!isDateKey(dateKey)) {
    return null;
  }

  const {
    start,
    end,
  } = getIstDayRange(dateKey);

  const categories =
    await QuizQuestion.aggregate([
      {
        $match: {
          active: true,
          scheduledDate: {
            $gte: start,
            $lte: end,
          },
        },
      },
      {
        $group: {
          _id: {
            category: "$category",
            subject: {
              $ifNull: [
                "$subject",
                "$category",
              ],
            },
          },
          questionCount: {
            $sum: 1,
          },
        },
      },
      {
        $project: {
          _id: 0,
          category:
            "$_id.category",
          subject:
            "$_id.subject",
          questionCount: 1,
        },
      },
      {
        $sort: {
          subject: 1,
          category: 1,
        },
      },
    ]);

  return {
    date: dateKey,
    durationMinutes:
      await getQuizDuration(dateKey),
    categories,
  };
};

const getQuizSetting = async (
  dateKey = toDateKey()
) => {
  if (!isDateKey(dateKey)) {
    return null;
  }

  const setting =
    await QuizSetting.findOne({
      dateKey,
    }).lean();

  return {
    dateKey,
    durationMinutes:
      setting?.durationMinutes ||
      DEFAULT_DURATION_MINUTES,
    isActive:
      setting?.isActive ?? true,
  };
};

const upsertQuizSetting = async ({
  dateKey,
  durationMinutes,
  isActive = true,
}) => {
  if (
    !isDateKey(dateKey) ||
    !Number.isInteger(
      Number(durationMinutes)
    ) ||
    Number(durationMinutes) < 1 ||
    Number(durationMinutes) >
      MAX_DURATION_MINUTES
  ) {
    return null;
  }

  return QuizSetting.findOneAndUpdate(
    { dateKey },
    {
      $set: {
        durationMinutes:
          Number(durationMinutes),
        isActive:
          Boolean(isActive),
      },
      $setOnInsert: {
        dateKey,
      },
    },
    {
      returnDocument: "after",
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );
};

const setQuizDurationForDate = async (
  dateKey,
  durationMinutes
) => {
  const currentSetting =
    await getQuizSettingForDate(dateKey);

  return upsertQuizSetting({
    dateKey,
    durationMinutes,
    isActive: currentSetting?.isActive ?? true,
  });
};

const normalizeQuestionData = (
  questionData
) => {
  const text = {
    en: questionData.text?.en?.trim() || "",
  };

  if (questionData.text?.hi?.trim()) {
    text.hi =
      questionData.text.hi.trim();
  }

  const options = Array.isArray(
    questionData.options
  )
    ? questionData.options.map(
        (option) =>
          String(option || "").trim()
      )
    : [];

  return {
    text,
    subject:
      String(
        questionData.subject || ""
      ).trim(),
    category:
      String(
        questionData.category || ""
      ).trim(),
    options,
    correctIndex:
      Number(questionData.correctIndex),
    explanation:
      String(
        questionData.explanation || ""
      ).trim(),
    difficulty:
      Number(questionData.difficulty || 1),
    scheduledDate:
      questionData.scheduledDate || null,
    active:
      questionData.active !== false,
  };
};

const validateQuestionData = (
  questionData
) => {
  const errors = [];

  const question =
    normalizeQuestionData(
      questionData
    );

  if (
    question.text.en.length < 5 ||
    question.text.en.length > 1000
  ) {
    errors.push(
      "English question must be between 5 and 1000 characters."
    );
  }

  if (
    question.text.hi &&
    question.text.hi.length > 1000
  ) {
    errors.push(
      "Hindi question cannot exceed 1000 characters."
    );
  }

  if (
    question.subject.length < 2 ||
    question.subject.length > 80
  ) {
    errors.push(
      "Subject must be between 2 and 80 characters."
    );
  }

  if (
    question.category.length < 2 ||
    question.category.length > 80
  ) {
    errors.push(
      "Category must be between 2 and 80 characters."
    );
  }

  if (
    question.options.length !== 4 ||
    question.options.some(
      (option) =>
        !option ||
        option.length > 300
    )
  ) {
    errors.push(
      "All four options are required and must not exceed 300 characters."
    );
  }

  if (
    !Number.isInteger(
      question.correctIndex
    ) ||
    question.correctIndex < 0 ||
    question.correctIndex > 3
  ) {
    errors.push(
      "Correct option must be between 0 and 3."
    );
  }

  if (
    question.explanation.length < 5 ||
    question.explanation.length > 1200
  ) {
    errors.push(
      "Explanation must be between 5 and 1200 characters."
    );
  }

  if (
    !Number.isInteger(
      question.difficulty
    ) ||
    question.difficulty < 1 ||
    question.difficulty > 5
  ) {
    errors.push(
      "Difficulty must be between 1 and 5."
    );
  }

  if (
    question.scheduledDate &&
    !isDateKey(
      question.scheduledDate
    )
  ) {
    errors.push(
      "Scheduled date must be a valid YYYY-MM-DD date."
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    question,
  };
};

const getActiveCategory = async (
  categoryName
) => {
  return QuizCategory.findOne({
    name: categoryName,
    active: true,
  })
    .select("_id name")
    .lean();
};

const createQuestion = async (questionData) => {
  const validation =
    validateQuestionData(
      questionData
    );

  if (!validation.valid) {
    return {
      validationError:
        validation.errors.join(" "),
    };
  }

  const question =
    validation.question;

  const category =
    await getActiveCategory(
      question.category
    );

  if (!category) {
    return {
      categoryInactive: true,
    };
  }

  const scheduledDate =
    question.scheduledDate ||
    toDateKey();

  return QuizQuestion.create({
    ...question,
    scheduledDate:
      getIstDayRange(
        scheduledDate
      ).start,
  });
};

const updateQuizQuestion = async (
  questionId,
  questionData
) => {
  if (
    !mongoose.isValidObjectId(
      questionId
    )
  ) {
    return {
      invalidId: true,
    };
  }

  const existingQuestion =
    await QuizQuestion.findById(
      questionId
    );

  if (!existingQuestion) {
    return {
      notFound: true,
    };
  }

  const referencedAttempt = await QuizAttempt.exists({
    questionIds: existingQuestion._id,
  });
  if (referencedAttempt) {
    return { historyProtected: true };
  }

  const validation =
    validateQuestionData(
      questionData
    );

  if (!validation.valid) {
    return {
      validationError:
        validation.errors.join(" "),
    };
  }

  const question =
    validation.question;

  const category =
    await getActiveCategory(
      question.category
    );

  if (!category) {
    return {
      categoryInactive: true,
    };
  }

  const scheduledDate =
    question.scheduledDate ||
    toDateKey();

  existingQuestion.text =
    question.text;

  existingQuestion.subject =
    question.subject;

  existingQuestion.category =
    question.category;

  existingQuestion.options =
    question.options;

  existingQuestion.correctIndex =
    question.correctIndex;

  existingQuestion.explanation =
    question.explanation;

  existingQuestion.difficulty =
    question.difficulty;

  existingQuestion.scheduledDate =
    getIstDayRange(
      scheduledDate
    ).start;

  existingQuestion.active =
    question.active;

  await existingQuestion.save();

  return {
    updated: true,
    question: existingQuestion,
  };
};

const getQuizQuestions = async ({
  category = "",
  subject = "",
  dateKey = "",
  search = "",
  page = 1,
  limit = 40,
}) => {
  const filter = {};

  if (category.trim()) {
    filter.category =
      category.trim();
  }

  if (subject.trim()) {
    filter.subject =
      subject.trim();
  }

  if (dateKey) {
    if (!isDateKey(dateKey)) {
      return null;
    }

    const {
      start,
      end,
    } = getIstDayRange(dateKey);

    filter.scheduledDate = {
      $gte: start,
      $lte: end,
    };
  }

  const searchText =
    search.trim();

  if (searchText) {
    const escapedSearch =
      searchText.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

    const searchRegex =
      new RegExp(
        escapedSearch,
        "i"
      );

    filter.$or = [
      {
        "text.en":
          searchRegex,
      },
      {
        "text.hi":
          searchRegex,
      },
      {
        category:
          searchRegex,
      },
      {
        subject:
          searchRegex,
      },
      {
        explanation:
          searchRegex,
      },
    ];
  }

  const pageNumber =
    Math.max(
      1,
      Number(page) || 1
    );

  const limitNumber =
    Math.min(
      100,
      Math.max(
        1,
        Number(limit) || 40
      )
    );

  const skip =
    (pageNumber - 1) *
    limitNumber;

  const [
    questions,
    total,
  ] = await Promise.all([
    QuizQuestion.find(filter)
      .sort({
        scheduledDate: -1,
        category: 1,
        createdAt: -1,
      })
      .skip(skip)
      .limit(limitNumber)
      .lean(),

    QuizQuestion.countDocuments(
      filter
    ),
  ]);

  const totalPages =
    Math.ceil(
      total / limitNumber
    );

  return {
    questions,
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      total,
      totalPages,
      hasNextPage:
        pageNumber < totalPages,
      hasPreviousPage:
        pageNumber > 1,
    },
  };
};

const importQuizQuestions = async (
  buffer,
  durationMinutes
) => {
  const duration = Number(durationMinutes);
  if (
    !Number.isInteger(duration) ||
    duration < 1 ||
    duration > MAX_DURATION_MINUTES
  ) {
    const error = new Error(
      "Quiz duration must be between 1 and 180 minutes."
    );
    error.statusCode = 400;
    throw error;
  }

  const questions =
    await parseQuizWordDocument(
      buffer
    );

  if (
    questions.length >
    MAX_QUESTIONS_PER_IMPORT
  ) {
    const error = new Error(
      `A Word import can contain at most ${MAX_QUESTIONS_PER_IMPORT} questions.`
    );

    error.statusCode = 400;

    throw error;
  }

  const categoryNames = [
    ...new Set(
      questions.map(
        (question) =>
          question.category
      )
    ),
  ];

  await Promise.all(
    categoryNames.map(
      async (name) => {
        const normalizedName =
          name
            .trim()
            .toLocaleLowerCase(
              "en-IN"
            );

        await QuizCategory.updateOne(
          {
            normalizedName,
          },
          {
            $setOnInsert: {
              name: name.trim(),
              normalizedName,
              active: true,
            },
          },
          {
            upsert: true,
          }
        );
      }
    )
  );

  const importDateKey = toDateKey();
  const normalizedQuestions =
    questions.map(
      (question) => {
        return {
          ...question,
          scheduledDate:
            getIstDayRange(
              importDateKey
            ).start,
          active:
            question.active !== false,
        };
      }
    );

  const inserted =
    await QuizQuestion.insertMany(
      normalizedQuestions,
      {
        ordered: true,
      }
    );

  await setQuizDurationForDate(
    importDateKey,
    duration
  );

  return {
    importedCount:
      inserted.length,
    scheduledDate: importDateKey,
  };
};

const setQuizQuestionStatus =
  async (
    questionId,
    active
  ) => {
    if (
      !mongoose.isValidObjectId(
        questionId
      )
    ) {
      return null;
    }

    if (
      typeof active !==
      "boolean"
    ) {
      return null;
    }

    return QuizQuestion.findByIdAndUpdate(
      questionId,
      {
        $set: {
          active,
        },
      },
      {
        returnDocument: "after",
        runValidators: true,
      }
    );
  };

const deleteQuizQuestion =
  async (questionId) => {
    if (
      !mongoose.isValidObjectId(
        questionId
      )
    ) {
      return {
        invalidId: true,
      };
    }

    const question =
      await QuizQuestion.findById(
        questionId
      );

    if (!question) {
      return {
        notFound: true,
      };
    }

    const { start: todayStart } =
      getIstDayRange(toDateKey());
    if (
      question.scheduledDate &&
      question.scheduledDate > todayStart
    ) {
      return {
        futureQuestion: true,
      };
    }

    await question.deleteOne();

    return {
      deleted: true,
    };
  };

const deleteQuizQuestions = async (questionIds) => {
  if (
    !Array.isArray(questionIds) ||
    questionIds.length < 1 ||
    questionIds.length > 500 ||
    questionIds.some((id) => !mongoose.isValidObjectId(id))
  ) {
    return { invalidIds: true };
  }

  const uniqueIds = [...new Set(questionIds.map(String))];
  const objectIds = uniqueIds.map((id) => new mongoose.Types.ObjectId(id));
  const { start: todayStart } =
    getIstDayRange(toDateKey());
  const deletableQuestions =
    await QuizQuestion.find({
      _id: { $in: objectIds },
      scheduledDate: { $lte: todayStart },
    })
      .select("_id")
      .lean();
  const deletableQuestionIds =
    deletableQuestions.map((question) => question._id);
  const eligibleIdStrings = new Set(
    deletableQuestionIds.map(String)
  );
  const deletableIds = objectIds.filter((id) =>
    eligibleIdStrings.has(String(id))
  );

  const result = await QuizQuestion.deleteMany({
    _id: { $in: deletableIds },
    scheduledDate: { $lte: todayStart },
  });

  return {
    deletedCount: result.deletedCount || 0,
    skippedCount: uniqueIds.length - (result.deletedCount || 0),
  };
};

const deleteQuizCategory =
  async (categoryId) => {
    if (
      !mongoose.isValidObjectId(
        categoryId
      )
    ) {
      return {
        invalidId: true,
      };
    }

    const category =
      await QuizCategory.findById(
        categoryId
      );

    if (!category) {
      return {
        notFound: true,
      };
    }

    const questionUsage =
      await QuizQuestion.aggregate([
        {
          $match: {
            category: category.name,
          },
        },
        {
          $group: {
            _id: "$active",
            count: {
              $sum: 1,
            },
          },
        },
      ]);

    const questionCount = questionUsage.reduce(
      (total, usage) => total + usage.count,
      0
    );

    if (questionCount > 0) {
      return {
        usedByQuestion: true,
        questionCount,
        activeQuestionCount:
          questionUsage.find((usage) => usage._id === true)?.count || 0,
      };
    }

    await category.deleteOne();

    return {
      deleted: true,
    };
  };

module.exports = {
  getQuizSettingForDate,
  getQuizDuration,

  getAttemptQuestions,
  buildStartResponse,

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

  getQuizSetting,
  upsertQuizSetting,

  createQuizCategory,
  updateQuizCategory,

  createQuestion,
  updateQuizQuestion,
  getQuizQuestions,

  importQuizQuestions,

  setQuizQuestionStatus,
  deleteQuizQuestion,
  deleteQuizQuestions,
  deleteQuizCategory,

  expireAttempt,
  isAttemptExpired,
  calculateAttemptResult,
};
