const blogCategoryService =
    require("../services/blogCategoryService");

// Create Category

const createCategory = async (req, res) => {
    const category =
        await blogCategoryService.createCategory(
            req.body
        );

    res.status(201).json({
        success: true,
        message:
            "Blog category created successfully",
        data: category,
    });
};

// Public Categories

const getPublicCategories = async (
    req,
    res
) => {
    const result =
        await blogCategoryService.getPublicCategories(
            req.query
        );

    res.status(200).json({
        success: true,
        data: result.categories,
        pagination: result.pagination,
    });
};

// Admin Categories

const getAdminCategories = async (
    req,
    res
) => {
    const result =
        await blogCategoryService.getAdminCategories(
            req.query
        );

    res.status(200).json({
        success: true,
        data: result.categories,
        pagination: result.pagination,
    });
};

// Get Category By ID

const getCategoryById = async (
    req,
    res
) => {
    const category =
        await blogCategoryService.getCategoryById(
            req.params.id
        );

    res.status(200).json({
        success: true,
        data: category,
    });
};

// Update Category

const updateCategory = async (
    req,
    res
) => {
    const category =
        await blogCategoryService.updateCategory(
            req.params.id,
            req.body
        );

    res.status(200).json({
        success: true,
        message:
            "Blog category updated successfully",
        data: category,
    });
};

// Update Category Status

const updateCategoryStatus = async (
    req,
    res
) => {
    const category =
        await blogCategoryService.updateCategoryStatus(
            req.params.id,
            req.body.isActive
        );

    res.status(200).json({
        success: true,
        message:
            "Blog category status updated successfully",
        data: category,
    });
};

// Delete Category

const deleteCategory = async (
    req,
    res
) => {
    await blogCategoryService.deleteCategory(
        req.params.id
    );

    res.status(200).json({
        success: true,
        message:
            "Blog category deleted successfully",
    });
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