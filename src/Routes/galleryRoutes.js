const express = require("express");

const {
    uploadGalleryImages,
    fetchGallery,
    editGallery,
    removeGallery
} = require("../controllers/galleryController");

const {
    createGallerySchema,
    updateGallerySchema
} = require("../validators/galleryValidator");

const asyncHandler = require("../utils/asyncHandler");
const authMiddleware = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");
const csrfMiddleware = require("../middleware/csrfMiddleware");
const upload = require("../middleware/uploadMiddleware");
const validate = require("../middleware/validateMiddleware");

const router = express.Router();


// Create Gallery
router.post(
    "/",
    authMiddleware,
    authorize("superAdmin", "admin"),
    csrfMiddleware,
    upload.array("images", 10),
    validate(createGallerySchema),
    asyncHandler(uploadGalleryImages)
);


// Get Gallery
router.get(
    "/",
    asyncHandler(fetchGallery)
);


// Update Gallery
router.put(
    "/:id",
    authMiddleware,
    authorize("superAdmin", "admin"),
    csrfMiddleware,
    upload.single("image"),
    validate(updateGallerySchema),
    asyncHandler(editGallery)
);


// Delete Gallery
router.delete(
    "/:id",
    authMiddleware,
    authorize("superAdmin", "admin"),
    csrfMiddleware,
    asyncHandler(removeGallery)
);


module.exports = router;