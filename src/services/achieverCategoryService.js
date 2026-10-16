
const AchieverCategory = require("../models/AchieverCategory");
const Achiever = require("../models/Achiever");
const ApiError = require("../utils/ApiError");

const createSlug = (name) => {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
};

const generateUniqueSlug = async (name, excludeId = null) => {
    const baseSlug = createSlug(name) || "category";
    let slug = baseSlug;
    let count = 1;

    while (
        await AchieverCategory.findOne({
            slug,
            ...(excludeId ? { _id: { $ne: excludeId } } : {}),
        })
    ) {
        slug = `${baseSlug}-${count}`;
        count++;
    }

    return slug;
};

const createCategory = async (data) => {
    const slug = await generateUniqueSlug(data.name);

    try {
        return await AchieverCategory.create({
            name: data.name,
            slug,
            isActive: data.isActive ?? true,
        });
    } catch (error) {
        if (error.code === 11000) {
            throw new ApiError(409, "Category already exists.");
        }
        throw error;
    }
};

const getCategories = async (includeInactive = false) => {
    const filter = includeInactive ? {} : { isActive: true };

    return AchieverCategory.find(filter).sort({ name: 1 });
};

const updateCategory = async (id, data) => {
    const category = await AchieverCategory.findById(id);

    if (!category) {
        throw new ApiError(404, "Achiever category not found.");
    }

    if (data.name !== undefined) {
        category.name = data.name;
        category.slug = await generateUniqueSlug(data.name, category._id);
    }

    if (data.isActive !== undefined) {
        category.isActive = data.isActive;
    }

    try {
        await category.save();
        return category;
    } catch (error) {
        if (error.code === 11000) {
            throw new ApiError(409, "Category already exists.");
        }
        throw error;
    }
};

const deleteCategory = async (id) => {
    const category = await AchieverCategory.findById(id);

    if (!category) {
        throw new ApiError(404, "Achiever category not found.");
    }

    const studentCount = await Achiever.countDocuments({
        categoryId: category._id,
    });

    if (studentCount > 0) {
        throw new ApiError(
            409,
            "This category contains students. Remove or reassign them first."
        );
    }

    await category.deleteOne();

    return { id: category._id };
};

module.exports = {
    createCategory,
    getCategories,
    updateCategory,
    deleteCategory,
};
