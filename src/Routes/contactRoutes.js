const express = require("express");

const {
    submitContact,
    fetchContacts,
    fetchContactById,
    updateStatus,
    deleteContact,
} = require("../controllers/contactController");

const validate = require("../middleware/validateMiddleware");
const contactSchema = require("../validators/contactValidator");
const asyncHandler = require("../utils/asyncHandler");

const authMiddleware = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const router = express.Router();


// PUBLIC
// Submit enquiries from the website.
router.post(
    "/",
    validate(contactSchema),
    asyncHandler(submitContact)
);


// PROTECTED ADMIN ROUTES

router.get(
    "/",
    authMiddleware,
    authorize("superAdmin", "admin"),
    asyncHandler(fetchContacts)
);


router.get(
    "/:id",
    authMiddleware,
    authorize("superAdmin", "admin"),
    asyncHandler(fetchContactById)
);


router.put(
    "/:id",
    authMiddleware,
    authorize("superAdmin", "admin"),
    asyncHandler(updateStatus)
);


router.delete(
    "/:id",
    authMiddleware,
    authorize("superAdmin", "admin"),
    asyncHandler(deleteContact)
);


module.exports = router;