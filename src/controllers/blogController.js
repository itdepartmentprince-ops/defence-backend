const blogService = require("../services/blogService");

// Create Blog

const createBlog = async (req, res) => {
    const blog = await blogService.createBlog(
        req.body,
        req.files,
        req.user.id
    );

    res.status(201).json({
        success: true,
        message: "Blog created successfully",
        data: blog,
    });
};

// Get Public Blogs

const getPublicBlogs = async (req, res) => {
    const result =
        await blogService.getPublicBlogs(
            req.query
        );

    res.status(200).json({
        success: true,
        data: result.blogs,
        pagination: result.pagination,
    });
};

// Get Admin Blogs

const getAdminBlogs = async (req, res) => {
    const result =
        await blogService.getAdminBlogs(
            req.query
        );

    res.status(200).json({
        success: true,
        data: result.blogs,
        pagination: result.pagination,
    });
};

// Get Blog By ID

const getBlogById = async (req, res) => {
    const blog =
        await blogService.getBlogById(
            req.params.id
        );

    res.status(200).json({
        success: true,
        data: blog,
    });
};

// Get Blog By Slug

const getBlogBySlug = async (req, res) => {
    const blog =
        await blogService.getBlogBySlug(
            req.params.slug
        );

    res.status(200).json({
        success: true,
        data: blog,
    });
};

// Get Related Blogs

const getRelatedBlogs = async (req, res) => {
    const {
        categoryId,
        blogId,
    } = req.params;

    const limit =
        req.query.limit || 5;

    const blogs =
        await blogService.getRelatedBlogs(
            categoryId,
            blogId,
            limit
        );

    res.status(200).json({
        success: true,
        data: blogs,
    });
};

// Update Blog

const updateBlog = async (req, res) => {
    const blog =
        await blogService.updateBlog(
            req.params.id,
            req.body,
            req.files
        );

    res.status(200).json({
        success: true,
        message: "Blog updated successfully",
        data: blog,
    });
};

// Delete Blog

const deleteBlog = async (req, res) => {
    await blogService.deleteBlog(
        req.params.id
    );

    res.status(200).json({
        success: true,
        message: "Blog deleted successfully",
    });
};

// Update Blog Status

const updateBlogStatus = async (req, res) => {
    const blog =
        await blogService.updateBlogStatus(
            req.params.id,
            req.body.status
        );

    res.status(200).json({
        success: true,
        message: "Blog status updated successfully",
        data: blog,
    });
};

module.exports = {
    createBlog,
    getPublicBlogs,
    getAdminBlogs,
    getBlogById,
    getBlogBySlug,
    getRelatedBlogs,
    updateBlog,
    deleteBlog,
    updateBlogStatus,
};