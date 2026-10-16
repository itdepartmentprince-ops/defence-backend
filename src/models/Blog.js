const mongoose = require("mongoose");

// Rich text

const richTextSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: ["text", "link"],
            required: true,
        },

        text: {
            type: String,
            required: true,
            trim: true,
        },

        bold: {
            type: Boolean,
            default: false,
        },

        italic: {
            type: Boolean,
            default: false,
        },

        underline: {
            type: Boolean,
            default: false,
        },

        // Text color
        color: {
            type: String,
            trim: true,
            default: "",
        },

        url: {
            type: String,
            trim: true,
        },
    },
    {
        _id: false,
    }
);

// Content base

const contentSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: [
                "heading",
                "paragraph",
                "image",
                "list",
                "table",
                "quote",
                "faq",
                "link",
            ],
            required: true,
        },
    },
    {
        _id: false,
        discriminatorKey: "type",
    }
);

// Heading

const headingSchema = new mongoose.Schema(
    {
        level: {
            type: Number,
            enum: [2, 3],
            required: true,
        },

        content: {
            type: [richTextSchema],
            required: true,
        },
    },
    {
        _id: false,
    }
);

// Paragraph

const paragraphSchema = new mongoose.Schema(
    {
        content: {
            type: [richTextSchema],
            required: true,
        },
    },
    {
        _id: false,
    }
);

// Image

const imageSchema = new mongoose.Schema(
    {
        url: {
            type: String,
            required: true,
            trim: true,
        },

        publicId: {
            type: String,
            trim: true,
        },

        alt: {
            type: String,
            required: true,
            trim: true,
        },

        caption: {
            type: String,
            trim: true,
        },

        link: {
            type: String,
            trim: true,
        },
    },
    {
        _id: false,
    }
);

// Link

const linkSchema = new mongoose.Schema(
    {
        text: {
            type: String,
            required: true,
            trim: true,
        },

        url: {
            type: String,
            required: true,
            trim: true,
        },

        target: {
            type: String,
            enum: ["_self", "_blank"],
            default: "_blank",
        },
    },
    {
        _id: false,
    }
);

// List

const listSchema = new mongoose.Schema(
    {
        listType: {
            type: String,
            enum: ["ordered", "unordered"],
            required: true,
        },

        items: {
            type: [[richTextSchema]],
            required: true,
        },
    },
    {
        _id: false,
    }
);

// Table

const tableSchema = new mongoose.Schema(
    {
        headers: {
            type: [String],
            required: true,
        },

        rows: {
            type: [[String]],
            required: true,
        },
    },
    {
        _id: false,
    }
);

// Quote

const quoteSchema = new mongoose.Schema(
    {
        content: {
            type: [richTextSchema],
            required: true,
        },
    },
    {
        _id: false,
    }
);

// FAQ item

const faqItemSchema = new mongoose.Schema(
    {
        question: {
            type: [richTextSchema],
            required: true,
        },

        answer: {
            type: [richTextSchema],
            required: true,
        },
    },
    {
        _id: false,
    }
);

// FAQ

const faqSchema = new mongoose.Schema(
    {
        items: {
            type: [faqItemSchema],
            required: true,
        },
    },
    {
        _id: false,
    }
);

// Blog

const blogSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200,
        },

        slug: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            maxlength: 200,
        },

        excerpt: {
            type: String,
            required: true,
            trim: true,
            maxlength: 500,
        },

        category: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "BlogCategory",
            required: true,
        },

        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Admin",
            required: true,
        },

        status: {
            type: String,
            enum: ["draft", "published"],
            default: "draft",
        },

        publishedAt: {
            type: Date,
        },

        featuredImage: {
            url: {
                type: String,
                trim: true,
            },

            publicId: {
                type: String,
                trim: true,
            },
        },

        metaTitle: {
            type: String,
            trim: true,
            maxlength: 200,
        },

        metaDescription: {
            type: String,
            trim: true,
            maxlength: 500,
        },

        keywords: {
            type: [String],
            default: [],
        },

        content: {
            type: [contentSchema],
            required: true,
            default: [],
        },
    },
    {
        timestamps: true,
    }
);

// Content types

blogSchema.path("content").discriminator(
    "heading",
    headingSchema
);

blogSchema.path("content").discriminator(
    "paragraph",
    paragraphSchema
);

blogSchema.path("content").discriminator(
    "image",
    imageSchema
);

blogSchema.path("content").discriminator(
    "link",
    linkSchema
);

blogSchema.path("content").discriminator(
    "list",
    listSchema
);

blogSchema.path("content").discriminator(
    "table",
    tableSchema
);

blogSchema.path("content").discriminator(
    "quote",
    quoteSchema
);

blogSchema.path("content").discriminator(
    "faq",
    faqSchema
);

// Indexes

blogSchema.index({
    status: 1,
    publishedAt: -1,
    _id: -1,
});

blogSchema.index({
    status: 1,
    category: 1,
    createdAt: -1,
    _id: -1,
});

const Blog = mongoose.model(
    "Blog",
    blogSchema
);

module.exports = Blog;