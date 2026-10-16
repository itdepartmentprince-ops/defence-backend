require("dotenv").config();
const mongoose = require("mongoose");
const QuizAttempt = require("../models/QuizAttempt");
const QuizDailyParticipation = require("../models/QuizDailyParticipation");
const QuizQuestion = require("../models/QuizQuestion");
const PageView = require("../models/PageView");
const { toDateKey, getIstDayRange } = require("../utils/quizDate");

const asDate = (value, fallback = new Date()) => {
  const date = value ? new Date(value) : fallback;
  return Number.isNaN(date.getTime()) ? fallback : date;
};

const main = async () => {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI must be set before migration.");
  await mongoose.connect(process.env.MONGODB_URI);

  const database = mongoose.connection.db;
  const collections = new Set((await database.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name));
  let migratedQuestions = 0;
  let migratedAttempts = 0;
  let migratedPageViews = 0;

  const attemptIndexes = await QuizAttempt.collection.indexes().catch((error) => {
    if (error.code === 26 || error.codeName === "NamespaceNotFound") return [];
    throw error;
  });
  const oldIndex = attemptIndexes.find((index) => index.name === "visitorId_1_dateKey_1" && index.unique);
  if (oldIndex) await QuizAttempt.collection.dropIndex(oldIndex.name);
  const oldAttemptNumberIndex = attemptIndexes.find(
    (index) =>
      index.unique &&
      Object.keys(index.key).join(",") === "visitorId,dateKey,attemptNumber"
  );
  if (oldAttemptNumberIndex) {
    await QuizAttempt.collection.dropIndex(oldAttemptNumberIndex.name);
  }

  const participationIndexes = await QuizDailyParticipation.collection.indexes().catch((error) => {
    if (error.code === 26 || error.codeName === "NamespaceNotFound") return [];
    throw error;
  });
  for (const index of participationIndexes) {
    const indexKeys = Object.keys(index.key).join(",");
    if (
      index.unique &&
      (indexKeys === "visitorId,dateKey" ||
        indexKeys === "phoneNumber,dateKey" ||
        indexKeys === "phoneNumber,dateKey,subject")
    ) {
      await QuizDailyParticipation.collection.dropIndex(index.name);
    }
  }

  if (collections.has("quizquestions")) {
    const oldQuestions = await database.collection("quizquestions").find({}).toArray();
    if (oldQuestions.length) {
      const operations = oldQuestions.map((question) => ({
        updateOne: {
          filter: { _id: question._id },
          update: { $setOnInsert: {
            ...question,
            subject: question.subject || question.category || "General Knowledge",
            createdAt: question.createdAt || new Date(),
            updatedAt: question.updatedAt || new Date(),
          } },
          upsert: true,
        },
      }));
      const result = await QuizQuestion.collection.bulkWrite(operations, { ordered: false });
      migratedQuestions = result.upsertedCount;
    }
  }

  if (collections.has("quizattempts")) {
    const legacyAttempts = await database.collection("quizattempts").find({}).sort({ startedAt: 1, createdAt: 1 }).toArray();
    const legacyQuestionIdValues = legacyAttempts.flatMap((attempt) =>
      (attempt.questionIds || attempt.answers?.map((answer) => answer.questionId) || [])
        .filter(Boolean)
        .map((id) => String(id?._id || id))
    );
    const legacyQuestionIds = [...new Set(legacyQuestionIdValues)];
    const questionDocs = legacyQuestionIds.length
      ? await QuizQuestion.find({ _id: { $in: legacyQuestionIds } }).lean()
      : [];
    const questionsById = new Map(questionDocs.map((question) => [String(question._id), question]));

    for (const old of legacyAttempts) {
      if (await QuizAttempt.collection.findOne({ _id: old._id })) continue;
      const startedAt = asDate(old.startedAt || old.createdAt);
      const dateKey = old.dateKey || toDateKey(asDate(old.quizDate, startedAt));
      const quizDate = getIstDayRange(dateKey).start;
      const visitorId = String(old.visitorId || `legacy-${old._id}`);
      const latest = await QuizAttempt.collection.find({ visitorId, dateKey }).sort({ attemptNumber: -1 }).limit(1).next();
      const attemptNumber = Math.max(Number(latest?.attemptNumber || 0), 0) + 1;
      const ids = old.questionIds || (old.answers || []).map((answer) => answer.questionId).filter(Boolean);
      const answerByQuestion = new Map((old.answers || []).map((answer) => [String(answer.questionId?._id || answer.questionId), answer]));
      const answers = ids.map((id) => {
        const questionId = id?._id || id;
        const question = questionsById.get(String(questionId));
        const answer = answerByQuestion.get(String(questionId)) || {};
        const selectedIndex = answer.selectedIndex ?? answer.selected ?? null;
        return {
          questionId,
          subject: answer.subject || question?.subject || question?.category || "General Knowledge",
          selectedIndex,
          isCorrect: Boolean(answer.isCorrect),
          timeSpentMs: Math.max(0, Number(answer.timeSpentMs || 0)),
        };
      });
      const status = ["completed", "in_progress", "expired"].includes(old.status) ? old.status : "completed";
      const percentage = Math.max(0, Math.min(100, Number(old.percentage || 0)));
      const subjects = [...new Set(answers.map((answer) => answer.subject))];
      const document = {
        _id: old._id,
        visitorId,
        name: String(old.name || "Visitor").slice(0, 50),
        questionIds: ids,
        subjects,
        answers,
        score: Math.max(0, Number(old.score || old.correctCount || 0)),
        totalQuestions: Math.max(1, Number(old.totalQuestions || ids.length || answers.length || 1)),
        correctCount: Math.max(0, Number(old.correctCount || old.score || 0)),
        wrongCount: Math.max(0, Number(old.wrongCount || 0)),
        skippedCount: Math.max(0, Number(old.skippedCount || 0)),
        percentage,
        timeTakenMs: Math.max(0, Number(old.timeTakenMs || 0)),
        dateKey,
        quizDate,
        attemptNumber,
        startedAt,
        submittedAt: old.completedAt || old.submittedAt ? asDate(old.completedAt || old.submittedAt) : null,
        status,
        createdAt: asDate(old.createdAt, startedAt),
        updatedAt: asDate(old.updatedAt, startedAt),
      };
      if (document.status === "in_progress" && await QuizAttempt.collection.findOne({ visitorId, dateKey, status: "in_progress" })) {
        document.status = "expired";
      }
      await QuizAttempt.collection.insertOne(document);
      migratedAttempts += 1;
    }
  }

  if (collections.has("pageviews")) {
    const oldPageViews = await database.collection("pageviews").find({}).toArray();
    for (const old of oldPageViews) {
      if (!old.visitorId || !old.path) continue;
      const createdAt = asDate(old.timestamp || old.createdAt);
      await PageView.collection.updateOne(
        { _id: old._id },
        { $setOnInsert: {
          visitorId: String(old.visitorId),
          dateKey: old.dateKey || toDateKey(createdAt),
          path: String(old.path).slice(0, 250),
          referrer: String(old.referrer || "").slice(0, 250),
          landingPage: String(old.landingPage || "").slice(0, 250),
          device: String(old.device || "unknown").slice(0, 60),
          source: String(old.source || "legacy").slice(0, 100),
          createdAt,
          updatedAt: createdAt,
        } },
        { upsert: true }
      );
      migratedPageViews += 1;
    }
  }

  await QuizAttempt.collection.createIndex({ visitorId: 1, dateKey: 1, subject: 1, attemptNumber: 1 }, { unique: true });
  await QuizDailyParticipation.collection.createIndex({ visitorId: 1, dateKey: 1, subject: 1 }, { unique: true });
  await QuizAttempt.collection.createIndex({ dateKey: 1, status: 1, percentage: -1 });
  await QuizAttempt.collection.createIndex({ dateKey: 1, subjects: 1, status: 1 });
  await PageView.collection.createIndex({ dateKey: 1, visitorId: 1 });

  console.log(JSON.stringify({ migratedQuestions, migratedAttempts, migratedPageViews }));
  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error("Quiz data migration failed:", error.message);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
