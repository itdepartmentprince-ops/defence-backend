const mongoose = require("mongoose");

const Blog = require("../models/Blog");
const BlogCategory = require("../models/BlogCategory");
const ApiError = require("../utils/ApiError");

const {
    uploadImage,
    deleteImage,
} = require("../utils/cloudinaryUpload");

// Helpers

const normalizeSlug = (slug) => {
    return slug.trim().toLowerCase();
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

const validateBlogId = (id) => {
    if (!isValidObjectId(id)) {
        throw new ApiError(
            400,
            "Invalid blog ID"
        );
    }
};

const validateCategoryId = (id) => {
    if (!isValidObjectId(id)) {
        throw new ApiError(
            400,
            "Invalid category ID"
        );
    }
};

const validateStatus = (status) => {
    if (
        status !== undefined &&
        !["draft", "published"].includes(status)
    ) {
        throw new ApiError(
            400,
            "Invalid blog status"
        );
    }
};

const validateSlug = (slug) => {
    if (typeof slug !== "string") {
        throw new ApiError(
            400,
            "Slug must be a string"
        );
    }

    const normalizedSlug =
        normalizeSlug(slug);

    if (!normalizedSlug) {
        throw new ApiError(
            400,
            "Slug is required"
        );
    }

    if (normalizedSlug.length < 2) {
        throw new ApiError(
            400,
            "Slug must be at least 2 characters"
        );
    }

    if (normalizedSlug.length > 200) {
        throw new ApiError(
            400,
            "Slug cannot exceed 200 characters"
        );
    }

    if (
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
            normalizedSlug
        )
    ) {
        throw new ApiError(
            400,
            "Slug can contain only lowercase letters, numbers and hyphens"
        );
    }

    return normalizedSlug;
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

const isSafeLinkUrl = (value) => {
    if (
        typeof value !== "string" ||
        !value.trim() ||
        /[\u0000-\u001F\u007F\\]/.test(value)
    ) {
        return false;
    }

    try {
        const url = new URL(
            value.trim(),
            "https://relative.invalid"
        );

        return ["http:", "https:"].includes(
            url.protocol
        );
    } catch {
        return false;
    }
};

// Validate rich text

const validateRichText = (
    content,
    location = "content"
) => {
    if (!Array.isArray(content)) {
        throw new ApiError(
            400,
            `${location} must be an array`
        );
    }

    for (const item of content) {
        if (
            !item ||
            typeof item !== "object"
        ) {
            throw new ApiError(
                400,
                `Invalid rich text item in ${location}`
            );
        }

        if (
            !["text", "link"].includes(
                item.type
            )
        ) {
            throw new ApiError(
                400,
                `Invalid rich text type in ${location}`
            );
        }

        if (
            typeof item.text !== "string" ||
            !item.text.trim()
        ) {
            throw new ApiError(
                400,
                `Rich text must contain valid text in ${location}`
            );
        }

        if (
            item.color !== undefined &&
            item.color !== "" &&
            (
                typeof item.color !== "string" ||
                !/^#[0-9A-Fa-f]{6}$/.test(
                    item.color
                )
            )
        ) {
            throw new ApiError(
                400,
                `Invalid text color in ${location}. Use a valid hex color.`
            );
        }

        if (
            item.url !== undefined &&
            item.url !== "" &&
            !isSafeLinkUrl(item.url)
        ) {
            throw new ApiError(
                400,
                `Invalid or unsafe URL in ${location}`
            );
        }

        if (item.type === "link" && !isSafeLinkUrl(item.url)) {
            throw new ApiError(
                400,
                `A valid HTTP or HTTPS URL is required in ${location}`
            );
        }
    }
};

// Parse JSON fields from multipart/form-data

const parseJsonField = (
    value,
    fieldName
) => {
    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return undefined;
    }

    if (typeof value !== "string") {
        return value;
    }

    try {
        return JSON.parse(value);
    } catch {
        throw new ApiError(
            400,
            `${fieldName} must contain valid JSON`
        );
    }
};

// Validate content

const validateContent = (content) => {
    if (!Array.isArray(content)) {
        throw new ApiError(
            400,
            "Content must be an array"
        );
    }

    const allowedTypes = [
        "heading",
        "paragraph",
        "image",
        "link",
        "list",
        "table",
        "quote",
        "faq",
    ];

    for (const block of content) {
        if (
            !block ||
            typeof block !== "object"
        ) {
            throw new ApiError(
                400,
                "Invalid content block"
            );
        }

        if (
            !allowedTypes.includes(
                block.type
            )
        ) {
            throw new ApiError(
                400,
                "Invalid content block type"
            );
        }

        if (
            block.type === "link" &&
            !isSafeLinkUrl(block.url)
        ) {
            throw new ApiError(
                400,
                "Link blocks require a valid HTTP or HTTPS URL"
            );
        }

        if (
            block.type === "image" &&
            block.link !== undefined &&
            block.link !== "" &&
            !isSafeLinkUrl(block.link)
        ) {
            throw new ApiError(
                400,
                "Image links must use a valid HTTP or HTTPS URL"
            );
        }

        if (block.type === "heading") {
            validateRichText(
                block.content,
                "heading content"
            );
        }

        if (block.type === "paragraph") {
            validateRichText(
                block.content,
                "paragraph content"
            );
        }

        if (block.type === "quote") {
            validateRichText(
                block.content,
                "quote content"
            );
        }

        if (block.type === "list") {
            if (!Array.isArray(block.items)) {
                throw new ApiError(
                    400,
                    "List items must be an array"
                );
            }

            for (
                let i = 0;
                i < block.items.length;
                i++
            ) {
                validateRichText(
                    block.items[i],
                    `list item ${i + 1}`
                );
            }
        }

        if (block.type === "faq") {
            if (!Array.isArray(block.items)) {
                throw new ApiError(
                    400,
                    "FAQ items must be an array"
                );
            }

            for (
                let i = 0;
                i < block.items.length;
                i++
            ) {
                const faqItem =
                    block.items[i];

                if (
                    !faqItem ||
                    typeof faqItem !== "object"
                ) {
                    throw new ApiError(
                        400,
                        `Invalid FAQ item at index ${i}`
                    );
                }

                validateRichText(
                    faqItem.question,
                    `FAQ ${i + 1} question`
                );

                validateRichText(
                    faqItem.answer,
                    `FAQ ${i + 1} answer`
                );
            }
        }
    }
};

// Upload featured image

const uploadFeaturedImage = async (
    file
) => {
    if (!file) {
        return undefined;
    }

    return await uploadImage(
        file.buffer,
        "defence-academy/blog/featured"
    );
};

// Upload content images

const uploadContentImages = async (
    content,
    files
) => {
    const imageFiles =
        files?.contentImages || [];

    const uploadedImages = [];
    let fileIndex = 0;

    try {
        for (const block of content) {
            if (block.type !== "image") {
                continue;
            }

            if (!block.fileKey) {
                if (!block.url) {
                    throw new ApiError(
                        400,
                        "Content image requires fileKey or url"
                    );
                }

                continue;
            }

            const file =
                imageFiles[fileIndex];

            if (!file) {
                throw new ApiError(
                    400,
                    `Content image file not found for ${block.fileKey}`
                );
            }

            fileIndex++;

            const result =
                await uploadImage(
                    file.buffer,
                    "defence-academy/blog/content"
                );

            block.url = result.url;
            block.publicId =
                result.publicId;

            delete block.fileKey;

            uploadedImages.push(
                result.publicId
            );
        }

        if (
            fileIndex !== imageFiles.length
        ) {
            throw new ApiError(
                400,
                "Uploaded content images do not match content blocks"
            );
        }

        return uploadedImages;
    } catch (error) {
        for (const publicId of uploadedImages) {
            try {
                await deleteImage(
                    publicId
                );
            } catch (cleanupError) {
                console.error(
                    "Content image cleanup failed:",
                    cleanupError.message
                );
            }
        }

        throw error;
    }
};

// Get existing Cloudinary IDs from content

const getContentImageIds = (
    content = []
) => {
    return content
        .filter(
            (block) =>
                block.type === "image" &&
                block.publicId
        )
        .map(
            (block) =>
                block.publicId
        );
};

// Delete multiple Cloudinary images

const deleteImages = async (
    publicIds = []
) => {
    for (const publicId of publicIds) {
        try {
            await deleteImage(
                publicId
            );
        } catch (error) {
            console.error(
                "Cloudinary image deletion failed:",
                error.message
            );
        }
    }
};

// Create Blog

const createBlog = async (
    data,
    files,
    authorId
) => {
    const {
        title,
        slug,
        excerpt,
        category,
        status = "draft",
    } = data;

    const featuredFile =
        files?.featuredImage?.[0];

    const content =
        parseJsonField(
            data.content,
            "Content"
        ) || [];

    const keywords =
        parseJsonField(
            data.keywords,
            "Keywords"
        ) || [];

    const metaTitle =
        data.metaTitle?.trim();

    const metaDescription =
        data.metaDescription?.trim();

    if (
        typeof title !== "string" ||
        !title.trim()
    ) {
        throw new ApiError(
            400,
            "Blog title is required"
        );
    }

    if (
        typeof excerpt !== "string" ||
        !excerpt.trim()
    ) {
        throw new ApiError(
            400,
            "Blog excerpt is required"
        );
    }

    validateCategoryId(category);
    validateStatus(status);
    validateContent(content);

    if (!Array.isArray(keywords)) {
        throw new ApiError(
            400,
            "Keywords must be an array"
        );
    }

    const normalizedSlug =
        validateSlug(slug);

    const existingSlug =
        await Blog.findOne({
            slug: normalizedSlug,
        }).select("_id");

    if (existingSlug) {
        throw new ApiError(
            409,
            "Blog slug already exists"
        );
    }

    const existingCategory =
        await BlogCategory.findById(
            category
        );

    if (!existingCategory) {
        throw new ApiError(
            404,
            "Blog category not found"
        );
    }

    if (!existingCategory.isActive) {
        throw new ApiError(
            400,
            "Blog category is inactive"
        );
    }

    let uploadedFeaturedImage;
    let uploadedContentImages = [];

    try {
        if (featuredFile) {
            uploadedFeaturedImage =
                await uploadFeaturedImage(
                    featuredFile
                );
        }

        uploadedContentImages =
            await uploadContentImages(
                content,
                files
            );

        const blogData = {
            title: title.trim(),
            slug: normalizedSlug,
            excerpt: excerpt.trim(),
            category,
            author: authorId,
            status,
            featuredImage:
                uploadedFeaturedImage,
            metaTitle,
            metaDescription,
            keywords,
            content,
        };

        if (status === "published") {
            blogData.publishedAt =
                new Date();
        }

        return await Blog.create(
            blogData
        );
    } catch (error) {
        if (
            uploadedFeaturedImage?.publicId
        ) {
            try {
                await deleteImage(
                    uploadedFeaturedImage.publicId
                );
            } catch (cleanupError) {
                console.error(
                    "Featured image cleanup failed:",
                    cleanupError.message
                );
            }
        }

        await deleteImages(
            uploadedContentImages
        );

        if (error.code === 11000) {
            throw new ApiError(
                409,
                "Blog slug already exists"
            );
        }

        throw error;
    }
};

// Public Blogs

const getPublicBlogs = async (
    query = {}
) => {
    let {
        page = 1,
        limit = 10,
        search,
        category,
        excludeCategory,
        excludeCategorySlug,
    } = query;

    const pagination =
        validatePagination(
            page,
            limit
        );

    page = pagination.page;
    limit = pagination.limit;

    search =
        validateSearch(search);

    const filter = {
        status: "published",
    };

    if (search) {
        const safeSearch =
            escapeRegex(search);

        filter.$or = [
            {
                title: {
                    $regex: safeSearch,
                    $options: "i",
                },
            },
            {
                excerpt: {
                    $regex: safeSearch,
                    $options: "i",
                },
            },
        ];
    }

    if (category) {
        validateCategoryId(category);

        filter.category =
            category;
    }

    let excludedCategoryId = excludeCategory;

    if (
        typeof excludeCategorySlug === "string" &&
        excludeCategorySlug.trim()
    ) {
        const excludedCategory =
            await BlogCategory.findOne({
                $or: [
                    {
                        slug: excludeCategorySlug
                            .trim()
                            .toLowerCase(),
                    },
                    {
                        name: new RegExp(
                            `^${escapeRegex(
                                excludeCategorySlug.trim()
                            )}$`,
                            "i"
                        ),
                    },
                ],
            })
                .select("_id")
                .lean();
        excludedCategoryId =
            excludedCategory?._id?.toString() ||
            excludedCategoryId;
    }

    if (excludedCategoryId) {
        validateCategoryId(excludedCategoryId);

        if (category === excludedCategoryId) {
            filter._id = { $exists: false };
        } else if (category) {
            filter.$and = [
                { category },
                { category: { $ne: excludedCategoryId } },
            ];
            delete filter.category;
        } else {
            filter.category = {
                $ne: excludedCategoryId,
            };
        }
    }

    const skip =
        (page - 1) * limit;

    const [
        blogs,
        totalBlogs,
    ] = await Promise.all([
        Blog.find(filter)
            .sort({
                publishedAt: -1,
                _id: -1,
            })
            .skip(skip)
            .limit(limit)
            .populate(
                "category",
                "name slug"
            )
            .populate(
                "author",
                "name"
            )
            .lean(),

        Blog.countDocuments(filter),
    ]);

    return {
        blogs,
        pagination: {
            page,
            limit,
            totalBlogs,
            totalPages:
                Math.ceil(
                    totalBlogs /
                        limit
                ),
        },
    };
};

// Admin Blogs

const getAdminBlogs = async (
    query = {}
) => {
    let {
        page = 1,
        limit = 10,
        search,
        category,
        status,
    } = query;

    const pagination =
        validatePagination(
            page,
            limit
        );

    page = pagination.page;
    limit = pagination.limit;

    search =
        validateSearch(search);

    validateStatus(status);

    const filter = {};

    if (search) {
        const safeSearch =
            escapeRegex(search);

        filter.$or = [
            {
                title: {
                    $regex: safeSearch,
                    $options: "i",
                },
            },
            {
                excerpt: {
                    $regex: safeSearch,
                    $options: "i",
                },
            },
        ];
    }

    if (category) {
        validateCategoryId(category);

        filter.category =
            category;
    }

    if (status) {
        filter.status = status;
    }

    const skip =
        (page - 1) * limit;

    const [
        blogs,
        totalBlogs,
    ] = await Promise.all([
        Blog.find(filter)
            .sort({
                createdAt: -1,
                _id: -1,
            })
            .skip(skip)
            .limit(limit)
            .populate(
                "category",
                "name slug"
            )
            .populate(
                "author",
                "name"
            )
            .lean(),

        Blog.countDocuments(filter),
    ]);

    return {
        blogs,
        pagination: {
            page,
            limit,
            totalBlogs,
            totalPages:
                Math.ceil(
                    totalBlogs /
                        limit
                ),
        },
    };
};

// Get Blog By ID

const getBlogById = async (
    id
) => {
    validateBlogId(id);

    const blog =
        await Blog.findById(id)
            .populate(
                "category",
                "name slug"
            )
            .populate(
                "author",
                "name"
            )
            .lean();

    if (!blog) {
        throw new ApiError(
            404,
            "Blog not found"
        );
    }

    return blog;
};

// Get Blog By Slug

const getBlogBySlug = async (
    slug
) => {
    const normalizedSlug =
        validateSlug(slug);

    const blog =
        await Blog.findOne({
            slug: normalizedSlug,
            status: "published",
        })
            .populate(
                "category",
                "name slug"
            )
            .populate(
                "author",
                "name"
            )
            .lean();

    if (!blog) {
        throw new ApiError(
            404,
            "Published blog not found"
        );
    }

    return blog;
};

// Get Related Blogs

const getRelatedBlogs = async (
    categoryId,
    currentBlogId,
    limit = 5
) => {
    validateCategoryId(categoryId);
    validateBlogId(currentBlogId);

    limit = Number(limit);

    if (
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 10
    ) {
        throw new ApiError(
            400,
            "Limit must be between 1 and 10"
        );
    }

    const blogs =
        await Blog.find({
            category: categoryId,
            status: "published",
            _id: {
                $ne: currentBlogId,
            },
        })
            .sort({
                publishedAt: -1,
                _id: -1,
            })
            .limit(limit)
            .populate(
                "category",
                "name slug"
            )
            .populate(
                "author",
                "name"
            )
            .select(
                "title slug excerpt featuredImage publishedAt category author"
            )
            .lean();

    return blogs;
};

// Update Blog

const updateBlog = async (
    id,
    data,
    files
) => {
    validateBlogId(id);

    const blog =
        await Blog.findById(id);

    if (!blog) {
        throw new ApiError(
            404,
            "Blog not found"
        );
    }

    const {
        title,
        slug,
        excerpt,
        category,
        metaTitle,
        metaDescription,
        keywords,
        content,
    } = data;

    if (title !== undefined) {
        if (
            typeof title !== "string" ||
            !title.trim()
        ) {
            throw new ApiError(
                400,
                "Blog title must be a valid string"
            );
        }

        blog.title =
            title.trim();
    }

    if (excerpt !== undefined) {
        if (
            typeof excerpt !== "string" ||
            !excerpt.trim()
        ) {
            throw new ApiError(
                400,
                "Blog excerpt must be a valid string"
            );
        }

        blog.excerpt =
            excerpt.trim();
    }

    if (slug !== undefined) {
        const normalizedSlug =
            validateSlug(slug);

        const existingSlug =
            await Blog.findOne({
                slug: normalizedSlug,
                _id: {
                    $ne: id,
                },
            }).select("_id");

        if (existingSlug) {
            throw new ApiError(
                409,
                "Blog slug already exists"
            );
        }

        blog.slug =
            normalizedSlug;
    }

    if (category !== undefined) {
        validateCategoryId(
            category
        );

        const existingCategory =
            await BlogCategory.findById(
                category
            );

        if (!existingCategory) {
            throw new ApiError(
                404,
                "Blog category not found"
            );
        }

        if (!existingCategory.isActive) {
            throw new ApiError(
                400,
                "Blog category is inactive"
            );
        }

        blog.category =
            category;
    }

    if (metaTitle !== undefined) {
        blog.metaTitle =
            metaTitle?.trim();
    }

    if (
        metaDescription !==
        undefined
    ) {
        blog.metaDescription =
            metaDescription?.trim();
    }

    if (keywords !== undefined) {
        const parsedKeywords =
            parseJsonField(
                keywords,
                "Keywords"
            );

        if (
            !Array.isArray(
                parsedKeywords
            )
        ) {
            throw new ApiError(
                400,
                "Keywords must be an array"
            );
        }

        blog.keywords =
            parsedKeywords;
    }

    const newFeaturedFile =
        files?.featuredImage?.[0];

    let newFeaturedImage;
    let oldFeaturedPublicId;
    let newContentImageIds = [];
    let oldContentImageIds = [];

    try {
        if (newFeaturedFile) {
            newFeaturedImage =
                await uploadFeaturedImage(
                    newFeaturedFile
                );

            oldFeaturedPublicId =
                blog.featuredImage
                    ?.publicId;

            blog.featuredImage =
                newFeaturedImage;
        }

        if (content !== undefined) {
            const parsedContent =
                parseJsonField(
                    content,
                    "Content"
                );

            validateContent(
                parsedContent
            );

            oldContentImageIds =
                getContentImageIds(
                    blog.content
                );

            newContentImageIds =
                await uploadContentImages(
                    parsedContent,
                    files
                );

            blog.content =
                parsedContent;
        }

        const updatedBlog =
            await blog.save();

        if (oldFeaturedPublicId) {
            await deleteImages([
                oldFeaturedPublicId,
            ]);
        }

        if (
            oldContentImageIds.length
        ) {
            await deleteImages(
                oldContentImageIds
            );
        }

        return updatedBlog;
    } catch (error) {
        if (
            newFeaturedImage?.publicId
        ) {
            try {
                await deleteImage(
                    newFeaturedImage.publicId
                );
            } catch (cleanupError) {
                console.error(
                    "New featured image cleanup failed:",
                    cleanupError.message
                );
            }
        }

        await deleteImages(
            newContentImageIds
        );

        if (error.code === 11000) {
            throw new ApiError(
                409,
                "Blog slug already exists"
            );
        }

        throw error;
    }
};

// Delete Blog

const deleteBlog = async (
    id
) => {
    validateBlogId(id);

    const blog =
        await Blog.findById(id);

    if (!blog) {
        throw new ApiError(
            404,
            "Blog not found"
        );
    }

    const publicIds = [];

    if (
        blog.featuredImage
            ?.publicId
    ) {
        publicIds.push(
            blog.featuredImage.publicId
        );
    }

    publicIds.push(
        ...getContentImageIds(
            blog.content
        )
    );

    await blog.deleteOne();

    await deleteImages(
        publicIds
    );

    return blog;
};

// Update Blog Status

const updateBlogStatus = async (
    id,
    status
) => {
    validateBlogId(id);
    validateStatus(status);

    const blog =
        await Blog.findById(id);

    if (!blog) {
        throw new ApiError(
            404,
            "Blog not found"
        );
    }

    if (status === "published") {
        blog.status = "published";

        if (!blog.publishedAt) {
            blog.publishedAt =
                new Date();
        }
    }

    if (status === "draft") {
        blog.status = "draft";
        blog.publishedAt =
            undefined;
    }

    return await blog.save();
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