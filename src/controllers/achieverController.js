
const mongoose = require("mongoose");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const achieverService = require("../services/achieverService");

const {
    createAchieverSchema,
    updateAchieverSchema,
    listAchieversSchema,
    adminListAchieversSchema,
} = require("../validators/achieverValidator");

const validate = (schema, data) => {
    const { error, value } = schema.validate(data, {
        abortEarly: false,
        convert: true,
    });

    if (error) {
        throw new ApiError(
            400,
            error.details.map((item) => item.message).join(", ")
        );
    }

    return value;
};

// Public: Get achievers, optionally filtered by category slug
const getPublicAchievers = asyncHandler(async (req, res) => {
    const query = validate(listAchieversSchema, req.query);

    const data = await achieverService.listAchievers(query, {
        categorySlug: req.params.categorySlug,
    });

    res.status(200).json({
        success: true,
        message: "Achievers fetched successfully.",
        data,
    });
});

// Admin: Get achievers, optionally filtered by category slug
const getAdminAchievers = asyncHandler(async (req, res) => {
    const query = validate(adminListAchieversSchema, req.query);

    const data = await achieverService.listAchievers(query, {
        admin: true,
        categorySlug: req.params.categorySlug,
    });

    res.status(200).json({
        success: true,
        message: "Admin achievers fetched successfully.",
        data,
    });
});

// Admin: Create achiever inside the category from the URL
const createAchiever = asyncHandler(async (req, res) => {
    const data = validate(createAchieverSchema, req.body);

    const achiever = await achieverService.createAchiever(
        data,
        req.file,
        req.params.categorySlug
    );

    res.status(201).json({
        success: true,
        message: "Achiever created successfully.",
        data: achiever,
    });
});

// Admin: Update achiever by ID
const updateAchiever = asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        throw new ApiError(400, "Invalid achiever ID.");
    }

    const data = validate(updateAchieverSchema, req.body);

    const achiever = await achieverService.updateAchiever(
        req.params.id,
        data,
        req.file
    );

    if (!achiever) {
        throw new ApiError(404, "Achiever not found.");
    }

    res.status(200).json({
        success: true,
        message: "Achiever updated successfully.",
        data: achiever,
    });
});

// Admin: Delete achiever by ID
const deleteAchiever = asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        throw new ApiError(400, "Invalid achiever ID.");
    }

    const achiever = await achieverService.deleteAchiever(req.params.id);

    if (!achiever) {
        throw new ApiError(404, "Achiever not found.");
    }

    res.status(200).json({
        success: true,
        message: "Achiever deleted successfully.",
    });
});

module.exports = {
    getPublicAchievers,
    getAdminAchievers,
    createAchiever,
    updateAchiever,
    deleteAchiever,
};
