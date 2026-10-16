const mongoose = require("mongoose");

const blogCategorySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            maxlength: 100,
        },

        slug: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            maxlength: 100,
        },

        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes

blogCategorySchema.index({
    isActive: 1,
    name: 1,
});

blogCategorySchema.index({
    isActive: 1,
    createdAt: -1,
    _id: -1,
});

const BlogCategory = mongoose.model(
    "BlogCategory",
    blogCategorySchema
);

module.exports = BlogCategory;