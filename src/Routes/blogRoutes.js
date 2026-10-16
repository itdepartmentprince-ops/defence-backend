const express = require("express");

const {
    createBlog,
    getPublicBlogs,
    getAdminBlogs,
    getBlogById,
    getBlogBySlug,
    getRelatedBlogs,
    updateBlog,
    deleteBlog,
    updateBlogStatus,
} = require("../controllers/blogController");

const authMiddleware =
    require("../middleware/authMiddleware");

const authorize =
    require("../middleware/roleMiddleware");

const csrfMiddleware =
    require("../middleware/csrfMiddleware");

const upload =
    require("../middleware/uploadMiddleware");

const asyncHandler =
    require("../utils/asyncHandler");

const router = express.Router();

// Public

router.get(
    "/",
    asyncHandler(getPublicBlogs)
);

router.get(
    "/slug/:slug",
    asyncHandler(getBlogBySlug)
);

router.get(
    "/related/:categoryId/:blogId",
    asyncHandler(getRelatedBlogs)
);

// Admin

router.get(
    "/admin",
    authMiddleware,
    authorize("superAdmin", "admin"),
    asyncHandler(getAdminBlogs)
);

router.post(
    "/",
    authMiddleware,
    authorize("superAdmin", "admin"),
    csrfMiddleware,
    upload.fields([
        {
            name: "featuredImage",
            maxCount: 1,
        },
        {
            name: "contentImages",
            maxCount: 20,
        },
    ]),
    asyncHandler(createBlog)
);

router.put(
    "/:id",
    authMiddleware,
    authorize("superAdmin", "admin"),
    csrfMiddleware,
    upload.fields([
        {
            name: "featuredImage",
            maxCount: 1,
        },
        {
            name: "contentImages",
            maxCount: 20,
        },
    ]),
    asyncHandler(updateBlog)
);

router.delete(
    "/:id",
    authMiddleware,
    authorize("superAdmin", "admin"),
    csrfMiddleware,
    asyncHandler(deleteBlog)
);

router.patch(
    "/:id/status",
    authMiddleware,
    authorize("superAdmin", "admin"),
    csrfMiddleware,
    asyncHandler(updateBlogStatus)
);

router.get(
    "/:id",
    authMiddleware,
    authorize("superAdmin", "admin"),
    asyncHandler(getBlogById)
);

module.exports = router;