const mongoose = require("mongoose");

const GalleryCategory = require("../models/GalleryCategory");
const Gallery = require("../models/Gallery")
const ApiError = require("../utils/ApiError");


const createGalleryCategory = async (categoryData) => {
    const { name } = categoryData;

    const slug = name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-");

    const existingCategory = await GalleryCategory.findOne({
        $or: [
            { name },
            { slug },
        ],
    });

    if (existingCategory) {
        throw new ApiError(
            409,
            "Gallery category already exists"
        );
    }

    const category = await GalleryCategory.create({
        name,
        slug,
    });

    return category;
};

const getGalleryCategories = async () => {
    const categories = await GalleryCategory.find()
        .sort({ createdAt: -1 });

    return categories;
};

const getGalleryCategoryById = async (id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(
            400,
            "Invalid gallery category ID"
        );
    }

    const category = await GalleryCategory.findById(id);

    if (!category) {
        throw new ApiError(
            404,
            "Gallery category not found"
        );
    }

    return category;
};

const updateGalleryCategory = async (id, categoryData) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(
            400,
            "Invalid gallery category ID"
        );
    }

    const category = await GalleryCategory.findById(id);

    if (!category) {
        throw new ApiError(
            404,
            "Gallery category not found"
        );
    }

    const { name } = categoryData;

    const slug = name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-");

    const existingCategory = await GalleryCategory.findOne({
        $or: [
            { name },
            { slug },
        ],
        _id: { $ne: id },
    });

    if (existingCategory) {
        throw new ApiError(
            409,
            "Gallery category already exists"
        );
    }

    category.name = name;
    category.slug = slug;

    await category.save();

    return category;
};

const updateGalleryCategoryStatus = async (
    id,
    isActive
) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(
            400,
            "Invalid gallery category ID"
        );
    }

    const category = await GalleryCategory.findByIdAndUpdate(
        id,
        { isActive },
          {
        returnDocument: "after",
        runValidators: true,
    }
    );

    if (!category) {
        throw new ApiError(
            404,
            "Gallery category not found"
        );
    }

    return category;
};

const deleteGalleryCategory = async (id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, "Invalid gallery category ID");
    }

    const category = await GalleryCategory.findById(id);

    if (!category) {
        throw new ApiError(404, "Gallery category not found");
    }

    const galleryCount = await Gallery.countDocuments({
        category: id,
    });

    if (galleryCount > 0) {
        throw new ApiError(
            409,
            "Cannot delete category because gallery images exist in this category"
        );
    }

    await GalleryCategory.findByIdAndDelete(id);

    return category;
};
module.exports = {
    createGalleryCategory,
    getGalleryCategories,
    getGalleryCategoryById,
    updateGalleryCategory,
    updateGalleryCategoryStatus,
    deleteGalleryCategory,
};