const mongoose = require("mongoose");

const gallerySchema = new mongoose.Schema(
    {
        title: {
            type: String,
            trim: true,
            maxlength: 100,
            default: "",
        },

        description: {
            type: String,
            trim: true,
            maxlength: 500,
            default: "",
        },

        category: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "GalleryCategory",
            required: true,
        },

        imageUrl: {
            type: String,
            required: true,
        },

        publicId: {
            type: String,
            required: true,
        },

        alt: {
            type: String,
            required: true,
            trim: true,
            maxlength: 150,
        },
    },
    {
        timestamps: true,
    }
);

module.exports =
    mongoose.model(
        "Gallery",
        gallerySchema
    );