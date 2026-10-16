
const { randomUUID } = require("node:crypto");
const mongoose = require("mongoose");
const Achiever = require("../models/Achiever");
const AchieverCategory = require("../models/AchieverCategory");
const ApiError = require("../utils/ApiError");
const { uploadImage, deleteImage } = require("../utils/cloudinaryUpload");

const escapeRegex = (value = "") =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const findCategoryBySlug = async (categorySlug) => {
    const category = await AchieverCategory.findOne({
        slug: categorySlug,
        isActive: true,
    });

    if (!category) {
        throw new ApiError(404, "Achiever category not found.");
    }

    return category;
};

const listAchievers = async (
    query = {},
    { admin = false, categorySlug } = {}
) => {
    const {
        page = 1,
        limit = 12,
        year,
        batch,
        search,
        status = "all",
        sort = "newest",
    } = query;

    const filter = {};

    if (categorySlug) {
        const category = await findCategoryBySlug(categorySlug);
        filter.categoryId = category._id;
    }

    if (!admin) {
        filter.isPublished = true;
    } else if (status === "published") {
        filter.isPublished = true;
    } else if (status === "draft") {
        filter.isPublished = false;
    }

    if (year) filter.year = Number(year);
    if (batch) filter.batch = batch;

    if (search) {
        const regex = new RegExp(escapeRegex(search.trim()), "i");

        filter.$or = [
            { name: regex },
            { fatherName: regex },
            { examName: regex },
            { address: regex },
        ];
    }

    const sortOptions = {
        newest: { year: -1, createdAt: -1 },
        oldest: { year: 1, createdAt: 1 },
        name: { name: 1 },
        order: { displayOrder: 1, year: -1 },
    };

    const currentPage = Math.max(1, Number(page) || 1);
    const pageLimit = Math.min(100, Math.max(1, Number(limit) || 12));
    const yearFilter = { ...filter };
    delete yearFilter.year;

    const [items, total, years] = await Promise.all([
        Achiever.find(filter)
            .select("-__v")
            .populate("categoryId", "name slug")
            .sort(sortOptions[sort] || sortOptions.newest)
            .skip((currentPage - 1) * pageLimit)
            .limit(pageLimit)
            .lean(),
        Achiever.countDocuments(filter),
        Achiever.distinct("year", yearFilter),
    ]);

    const totalPages = Math.ceil(total / pageLimit);
    years.sort((first, second) => second - first);

    return {
        items,
        years,
        pagination: {
            page: currentPage,
            limit: pageLimit,
            total,
            totalPages,
            hasNextPage: currentPage < totalPages,
            hasPrevPage: currentPage > 1,
        },
    };
};

const createAchiever = async (data, file, categorySlug) => {
    if (!categorySlug) {
        throw new ApiError(400, "Category slug is required.");
    }

    const category = await findCategoryBySlug(categorySlug);

    if (!file) {
        throw new ApiError(400, "Student photo is required.");
    }

    let photo;

    try {
        photo = await uploadImage(
            file.buffer,
            "defence-academy/achievers",
            { publicId: randomUUID() }
        );

        const {
            category: ignoredCategory,
            categoryId: ignoredCategoryId,
            slug: ignoredSlug,
            ...studentData
        } = data;

        return await Achiever.create({
            ...studentData,
            categoryId: category._id,
            photo,
        });
    } catch (error) {
        if (photo?.publicId) {
            await deleteImage(photo.publicId).catch(() => {});
        }

        throw error;
    }
};

const updateAchiever = async (id, data, file) => {
    if (!mongoose.isValidObjectId(id)) {
        throw new ApiError(400, "Invalid achiever ID.");
    }

    const achiever = await Achiever.findById(id);

    if (!achiever) return null;

    const oldPhoto = achiever.photo;
    let newPhoto;

    try {
        const {
            category: ignoredCategory,
            categoryId: ignoredCategoryId,
            slug: ignoredSlug,
            categorySlug,
            ...safeData
        } = data;

        Object.assign(achiever, safeData);

        if (categorySlug) {
            const category = await findCategoryBySlug(categorySlug);
            achiever.categoryId = category._id;
        }

        if (file) {
            newPhoto = await uploadImage(
                file.buffer,
                "defence-academy/achievers",
                { publicId: randomUUID() }
            );

            achiever.photo = newPhoto;
        }

        await achiever.save();

        if (
            newPhoto &&
            oldPhoto?.publicId &&
            oldPhoto.publicId !== newPhoto.publicId
        ) {
            await deleteImage(oldPhoto.publicId).catch((error) => {
                console.error(
                    "Old achiever photo cleanup failed:",
                    error.message
                );
            });
        }

        return achiever;
    } catch (error) {
        if (newPhoto?.publicId) {
            await deleteImage(newPhoto.publicId).catch(() => {});
        }

        throw error;
    }
};

const deleteAchiever = async (id) => {
    if (!mongoose.isValidObjectId(id)) {
        throw new ApiError(400, "Invalid achiever ID.");
    }

    const achiever = await Achiever.findById(id);

    if (!achiever) return null;

    await achiever.deleteOne();

    if (achiever.photo?.publicId) {
        await deleteImage(achiever.photo.publicId).catch((error) => {
            console.error(
                "Achiever photo cleanup failed:",
                error.message
            );
        });
    }

    return achiever;
};

module.exports = {
    listAchievers,
    createAchiever,
    updateAchiever,
    deleteAchiever,
};
