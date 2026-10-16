const express = require("express");

const {
    createCategory,
    getPublicCategories,
    getAdminCategories,
    getCategoryById,
    updateCategory,
    updateCategoryStatus,
    deleteCategory,
} = require("../controllers/blogCategoryController");

const authMiddleware =
    require("../middleware/authMiddleware");

const authorize =
    require("../middleware/roleMiddleware");

const asyncHandler =
    require("../utils/asyncHandler");

const router = express.Router();

// Public

router.get(
    "/",
    asyncHandler(getPublicCategories)
);

// Admin

router.get(
    "/admin",
    authMiddleware,
    authorize("superAdmin", "admin"),
    asyncHandler(getAdminCategories)
);

router.post(
    "/",
    authMiddleware,
    authorize("superAdmin", "admin"),
    asyncHandler(createCategory)
);

router.get(
    "/:id",
    authMiddleware,
    authorize("superAdmin", "admin"),
    asyncHandler(getCategoryById)
);

router.put(
    "/:id",
    authMiddleware,
    authorize("superAdmin", "admin"),
    asyncHandler(updateCategory)
);

router.patch(
    "/:id/status",
    authMiddleware,
    authorize("superAdmin", "admin"),
    asyncHandler(updateCategoryStatus)
);

router.delete(
    "/:id",
    authMiddleware,
    authorize("superAdmin", "admin"),
    asyncHandler(deleteCategory)
);

module.exports = router;