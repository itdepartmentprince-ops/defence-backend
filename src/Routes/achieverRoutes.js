
const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");
const csrfMiddleware = require("../middleware/csrfMiddleware");
const achieverUpload = require("../middleware/achieverUpload");
const controller = require("../controllers/achieverController");

const adminOnly = [
    authMiddleware,
    authorize("superAdmin"),
];

const adminMutation = [
    ...adminOnly,
    csrfMiddleware,
];

// Admin: Get achievers across all categories
router.get(
    "/admin",
    ...adminOnly,
    controller.getAdminAchievers
);

// Admin: Get achievers by category slug
router.get(
    "/admin/:categorySlug",
    ...adminOnly,
    controller.getAdminAchievers
);

// Admin: Create achiever
router.post(
    "/admin/:categorySlug",
    ...adminMutation,
    achieverUpload,
    controller.createAchiever
);

// Admin: Update achiever
router.patch(
    "/admin/:id",
    ...adminMutation,
    achieverUpload,
    controller.updateAchiever
);

// Admin: Delete achiever
router.delete(
    "/admin/:id",
    ...adminMutation,
    controller.deleteAchiever
);

// Public: Get all published achievers
router.get(
    "/",
    controller.getPublicAchievers
);

// Public: Get achievers by category slug
router.get(
    "/category/:categorySlug",
    controller.getPublicAchievers
);

module.exports = router;
