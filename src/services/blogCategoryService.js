const mongoose = require("mongoose");

const Blog = require("../models/Blog");
const BlogCategory = require("../models/BlogCategory");
const ApiError = require("../utils/ApiError");

// Helpers

const normalizeName = (name) => {
    return name.trim().replace(/\s+/g, " ");
};

const normalizeSlug = (slug) => {
    return slug.trim().toLowerCase();
};

const generateSlug = (name) => {
    return name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
};

const escapeRegex = (value) => {
    return value.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
    );
};

const isValidObjectId = (id) => {
    return mongoose.Types.ObjectId.isValid(id);
};

const validateCategoryId = (id) => {
    if (!isValidObjectId(id)) {
        throw new ApiError(
            400,
            "Invalid category ID"
        );
    }
};

const validateName = (name) => {
    if (typeof name !== "string") {
        throw new ApiError(
            400,
            "Category name must be a string"
        );
    }

    const normalizedName =
        normalizeName(name);

    if (!normalizedName) {
        throw new ApiError(
            400,
            "Category name is required"
        );
    }

    if (normalizedName.length < 2) {
        throw new ApiError(
            400,
            "Category name must be at least 2 characters"
        );
    }

    if (normalizedName.length > 100) {
        throw new ApiError(
            400,
            "Category name cannot exceed 100 characters"
        );
    }

    return normalizedName;
};

const validateSlug = (slug) => {
    if (typeof slug !== "string") {
        throw new ApiError(
            400,
            "Category slug must be a string"
        );
    }

    const normalizedSlug =
        normalizeSlug(slug);

    if (!normalizedSlug) {
        throw new ApiError(
            400,
            "Category slug is required"
        );
    }

    if (normalizedSlug.length < 2) {
        throw new ApiError(
            400,
            "Category slug must be at least 2 characters"
        );
    }

    if (normalizedSlug.length > 100) {
        throw new ApiError(
            400,
            "Category slug cannot exceed 100 characters"
        );
    }

    if (
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
            normalizedSlug
        )
    ) {
        throw new ApiError(
            400,
            "Category slug can contain only lowercase letters, numbers and hyphens"
        );
    }

    return normalizedSlug;
};

const validateIsActive = (isActive) => {
    if (
        isActive !== undefined &&
        typeof isActive !== "boolean"
    ) {
        throw new ApiError(
            400,
            "isActive must be a boolean"
        );
    }
};

const validatePagination = (
    page,
    limit
) => {
    page = Number(page);
    limit = Number(limit);

    if (
        !Number.isInteger(page) ||
        page < 1
    ) {
        throw new ApiError(
            400,
            "Page must be a positive integer"
        );
    }

    if (
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 50
    ) {
        throw new ApiError(
            400,
            "Limit must be between 1 and 50"
        );
    }

    return {
        page,
        limit,
    };
};

const validateSearch = (search) => {
    if (
        search !== undefined &&
        typeof search !== "string"
    ) {
        throw new ApiError(
            400,
            "Search must be a string"
        );
    }

    if (
        search &&
        search.trim().length > 100
    ) {
        throw new ApiError(
            400,
            "Search cannot exceed 100 characters"
        );
    }

    return search?.trim();
};

// Create Category

const createCategory = async (data) => {
    const {
        name,
    } = data;

    const normalizedName =
        validateName(name);

    const generatedSlug =
        generateSlug(normalizedName);

    const normalizedSlug =
        validateSlug(generatedSlug);

    const existingCategory =
        await BlogCategory.findOne({
            $or: [
                {
                    name: normalizedName,
                },
                {
                    slug: normalizedSlug,
                },
            ],
        });

    if (existingCategory) {
        if (
            existingCategory.name.toLowerCase() ===
            normalizedName.toLowerCase()
        ) {
            throw new ApiError(
                409,
                "Category name already exists"
            );
        }

        if (
            existingCategory.slug ===
            normalizedSlug
        ) {
            throw new ApiError(
                409,
                "Category slug already exists"
            );
        }
    }

    try {
        return await BlogCategory.create({
            name: normalizedName,
            slug: normalizedSlug,
        });
    } catch (error) {
        if (error.code === 11000) {
            throw new ApiError(
                409,
                "Category name or slug already exists"
            );
        }

        throw error;
    }
};

// Public Categories

const getPublicCategories = async (
    query = {}
) => {
    let {
        page = 1,
        limit = 10,
        search,
    } = query;

    const pagination =
        validatePagination(
            page,
            limit
        );

    page = pagination.page;
    limit = pagination.limit;

    search = validateSearch(search);

    const filter = {
        isActive: true,
    };

    if (search) {
        filter.name = {
            $regex: escapeRegex(search),
            $options: "i",
        };
    }

    const skip =
        (page - 1) * limit;

    const [
        categories,
        totalCategories,
    ] = await Promise.all([
        BlogCategory.find(filter)
            .sort({
                name: 1,
                _id: 1,
            })
            .skip(skip)
            .limit(limit)
            .lean(),

        BlogCategory.countDocuments(
            filter
        ),
    ]);

    return {
        categories,
        pagination: {
            page,
            limit,
            totalCategories,
            totalPages:
                Math.ceil(
                    totalCategories / limit
                ),
        },
    };
};

// Admin Categories

const getAdminCategories = async (
    query = {}
) => {
    let {
        page = 1,
        limit = 10,
        search,
        isActive,
    } = query;

    const pagination =
        validatePagination(
            page,
            limit
        );

    page = pagination.page;
    limit = pagination.limit;

    search = validateSearch(search);

    if (
        isActive !== undefined &&
        !["true", "false"].includes(
            String(isActive)
        )
    ) {
        throw new ApiError(
            400,
            "isActive must be true or false"
        );
    }

    const filter = {};

    if (search) {
        filter.name = {
            $regex: escapeRegex(search),
            $options: "i",
        };
    }

    if (isActive !== undefined) {
        filter.isActive =
            String(isActive) === "true";
    }

    const skip =
        (page - 1) * limit;

    const [
        categories,
        totalCategories,
    ] = await Promise.all([
        BlogCategory.find(filter)
            .sort({
                createdAt: -1,
                _id: -1,
            })
            .skip(skip)
            .limit(limit)
            .lean(),

        BlogCategory.countDocuments(
            filter
        ),
    ]);

    return {
        categories,
        pagination: {
            page,
            limit,
            totalCategories,
            totalPages:
                Math.ceil(
                    totalCategories / limit
                ),
        },
    };
};

// Get Category By ID

const getCategoryById = async (
    id
) => {
    validateCategoryId(id);

    const category =
        await BlogCategory.findById(id)
            .lean();

    if (!category) {
        throw new ApiError(
            404,
            "Category not found"
        );
    }

    return category;
};

// Update Category

const updateCategory = async (
    id,
    data
) => {
    validateCategoryId(id);

    const category =
        await BlogCategory.findById(id);

    if (!category) {
        throw new ApiError(
            404,
            "Category not found"
        );
    }

    const {
        name,
        slug,
        isActive,
    } = data;

    validateIsActive(isActive);

    let normalizedName;
    let normalizedSlug;

    if (name !== undefined) {
        normalizedName =
            validateName(name);
    }

    if (slug !== undefined) {
        normalizedSlug =
            validateSlug(slug);
    }

    if (
        normalizedName !== undefined ||
        normalizedSlug !== undefined
    ) {
        const duplicateConditions = [];

        if (
            normalizedName !== undefined
        ) {
            duplicateConditions.push({
                name: normalizedName,
            });
        }

        if (
            normalizedSlug !== undefined
        ) {
            duplicateConditions.push({
                slug: normalizedSlug,
            });
        }

        const existingCategory =
            await BlogCategory.findOne({
                _id: {
                    $ne: id,
                },
                $or: duplicateConditions,
            });

        if (existingCategory) {
            if (
                normalizedName &&
                existingCategory.name.toLowerCase() ===
                    normalizedName.toLowerCase()
            ) {
                throw new ApiError(
                    409,
                    "Category name already exists"
                );
            }

            if (
                normalizedSlug &&
                existingCategory.slug ===
                    normalizedSlug
            ) {
                throw new ApiError(
                    409,
                    "Category slug already exists"
                );
            }
        }
    }

    if (
        normalizedName !== undefined
    ) {
        category.name =
            normalizedName;
    }

    if (
        normalizedSlug !== undefined
    ) {
        category.slug =
            normalizedSlug;
    }

    if (
        isActive !== undefined
    ) {
        category.isActive =
            isActive;
    }

    try {
        return await category.save();
    } catch (error) {
        if (error.code === 11000) {
            throw new ApiError(
                409,
                "Category name or slug already exists"
            );
        }

        throw error;
    }
};

// Update Category Status

const updateCategoryStatus = async (
    id,
    isActive
) => {
    validateCategoryId(id);

    if (typeof isActive !== "boolean") {
        throw new ApiError(
            400,
            "isActive must be a boolean"
        );
    }

    const category =
        await BlogCategory.findById(id);

    if (!category) {
        throw new ApiError(
            404,
            "Category not found"
        );
    }

    category.isActive = isActive;

    return await category.save();
};

// Delete Category

const deleteCategory = async (
    id
) => {
    validateCategoryId(id);

    const category =
        await BlogCategory.findById(id);

    if (!category) {
        throw new ApiError(
            404,
            "Category not found"
        );
    }

    const blog =
        await Blog.findOne({
            category: id,
        }).select("_id");

    if (blog) {
        throw new ApiError(
            409,
            "Category is already used by a blog"
        );
    }

    await category.deleteOne();

    return category;
};

module.exports = {
    createCategory,
    getPublicCategories,
    getAdminCategories,
    getCategoryById,
    updateCategory,
    updateCategoryStatus,
    deleteCategory,
};