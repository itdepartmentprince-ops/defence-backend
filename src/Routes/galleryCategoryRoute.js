const express = require("express");

const {
    addGalleryCategory,
    fetchGalleryCategories,
    fetchGalleryCategoryById,
    editGalleryCategory,
    changeGalleryCategoryStatus,
    removeGalleryCategory,
} = require("../controllers/galleryCategoryController");

const asyncHandler = require("../utils/asyncHandler");
const authMiddleware = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");
const validate = require("../middleware/validateMiddleware");

const {
    createGalleryCategorySchema,
    updateGalleryCategorySchema,
    updateGalleryCategoryStatusSchema,
} = require("../validators/galleryCategoryValidator");

const router = express.Router();


// Create Category
router.post(
    "/",
    authMiddleware,
    authorize("superAdmin", "admin"),
    validate(createGalleryCategorySchema),
    asyncHandler(addGalleryCategory)
);


// Get All Categories
router.get(
    "/",
   
    asyncHandler(fetchGalleryCategories)
);


// Get Category By ID
router.get(
    "/:id",
   
    asyncHandler(fetchGalleryCategoryById)
);


// Update Category
router.put(
    "/:id",
    authMiddleware,
    authorize("superAdmin", "admin"),
    validate(updateGalleryCategorySchema),
    asyncHandler(editGalleryCategory)
);


// Update Category Status
router.patch(
    "/:id/status",
    authMiddleware,
    authorize("superAdmin", "admin"),
    validate(updateGalleryCategoryStatusSchema),
    asyncHandler(changeGalleryCategoryStatus)
);


// Delete Category
router.delete(
    "/:id",
    authMiddleware,
    authorize("superAdmin", "admin"),
    asyncHandler(removeGalleryCategory)
);


module.exports = router;