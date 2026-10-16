const express = require("express");

const {
    getDashboardStats,
} = require("../controllers/dashboardController");

const asyncHandler = require("../utils/asyncHandler");

const authMiddleware = require("../middleware/authMiddleware");

const authorize = require("../middleware/roleMiddleware");

const router = express.Router();

router.get(
    "/stats",
    authMiddleware,
    authorize("superAdmin", "admin"),
    asyncHandler(getDashboardStats)
);

router.get(
    "/summary",
    authMiddleware,
    authorize("superAdmin", "admin"),
    asyncHandler(getDashboardStats)
);

module.exports = router;