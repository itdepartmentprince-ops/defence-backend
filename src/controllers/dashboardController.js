const Admin = require("../models/Admin");
const Contact = require("../models/Contacts");
const Gallery = require("../models/Gallery");
const GalleryCategory = require("../models/GalleryCategory");
const Visitor = require("../models/Visitor");
const PageView = require("../models/PageView");
const QuizAttempt = require("../models/QuizAttempt");
const mongoose = require("mongoose");

const getDashboardStats = async (req, res) => {
    const zeroState = {
        totalAdmins: 0,
        totalContacts: 0,
        totalGalleryImages: 0,
        totalGalleryCategories: 0,
        totalVisitors: 0,
        totalPageViews: 0,
        totalQuizAttempts: 0,
        totalCompletedAttempts: 0,
        averageQuizScore: 0,
        quizCompletionRate: 0,
        leaderboard: [],
        dailyStats: [],
    };

    if (mongoose.connection.readyState !== 1) {
        return res.status(200).json({
            success: true,
            message: "Dashboard statistics fetched successfully",
            data: zeroState,
        });
    }

    const [
        totalAdmins,
        totalContacts,
        totalGalleryImages,
        totalGalleryCategories,
        totalVisitors,
        totalPageViews,
        totalQuizAttempts,
        totalCompletedAttempts,
        quizScoreStats,
        leaderboard,
    ] = await Promise.all([
        Admin.countDocuments(),
        Contact.countDocuments(),
        Gallery.countDocuments(),
        GalleryCategory.countDocuments(),
        Visitor.countDocuments(),
        PageView.countDocuments(),
        QuizAttempt.countDocuments(),
        QuizAttempt.countDocuments({ status: "completed" }),
        QuizAttempt.aggregate([
            { $match: { percentage: { $ne: null } } },
            { $group: { _id: null, averageQuizScore: { $avg: "$percentage" } } },
        ]),
        QuizAttempt.find({ status: "completed" })
            .sort({ percentage: -1, score: -1, submittedAt: 1 })
            .limit(5)
            .lean(),
    ]);

    const averageQuizScore = Number((quizScoreStats[0]?.averageQuizScore ?? 0).toFixed(1));
    const quizCompletionRate = totalQuizAttempts > 0
        ? Number(((totalCompletedAttempts / totalQuizAttempts) * 100).toFixed(1))
        : 0;

    res.status(200).json({
        success: true,
        message: "Dashboard statistics fetched successfully",
        data: {
            totalAdmins,
            totalContacts,
            totalGalleryImages,
            totalGalleryCategories,
            totalVisitors,
            totalPageViews,
            totalQuizAttempts,
            totalCompletedAttempts,
            averageQuizScore,
            quizCompletionRate,
            leaderboard: leaderboard.map((entry) => ({
                _id: entry._id,
                name: entry.name,
                score: entry.score,
                percentage: entry.percentage,
                submittedAt: entry.submittedAt,
            })),
            dailyStats: [],
        },
    });
};

module.exports = {
    getDashboardStats,
};