
const express = require("express");
const router = express.Router();

const {
    createCategory,
    getCategories,
    updateCategory,
    deleteCategory,
} = require("../controllers/achieverCategoryController");

const authMiddleware = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");
const csrfMiddleware = require("../middleware/csrfMiddleware");
const asyncHandler = require("../utils/asyncHandler");
const validate = require("../middleware/validateMiddleware");

const {
    createCategorySchema,
    updateCategorySchema,
} = require("../validators/achieverCategoryValidator");

// Public: Get categories
router.get(
    "/",
    asyncHandler(getCategories)
);

// Admin: Create category
router.post(
    "/",
    authMiddleware,
    authorize("superAdmin"),
    csrfMiddleware,
    validate(createCategorySchema),
    asyncHandler(createCategory)
);

// Admin: Update category
router.patch(
    "/:id",
    authMiddleware,
    authorize("superAdmin"),
    csrfMiddleware,
    validate(updateCategorySchema),
    asyncHandler(updateCategory)
);

// Admin: Delete category
router.delete(
    "/:id",
    authMiddleware,
    authorize("superAdmin"),
    csrfMiddleware,
    asyncHandler(deleteCategory)
);

module.exports = router;
