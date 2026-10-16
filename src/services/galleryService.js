const mongoose = require("mongoose");

const Gallery = require("../models/Gallery");
const GalleryCategory = require("../models/GalleryCategory");

const ApiError = require("../utils/ApiError");

const {
    uploadImage,
    deleteImage,
} = require("./cloudinaryService");


// CREATE GALLERY

const createGallery = async (galleryData, files) => {
    const {
        title,
        description,
        category,
        alt,
    } = galleryData;


    // Check category
    const existingCategory =
        await GalleryCategory.findOne({
            _id: category,
            isActive: true,
        });


    if (!existingCategory) {
        throw new ApiError(
            404,
            "Gallery category not found or inactive"
        );
    }


    // Check images
    if (!files || files.length === 0) {
        throw new ApiError(
            400,
            "At least one image is required"
        );
    }


    const uploadedImages = [];


    try {

        // Upload all images to Cloudinary
        for (const file of files) {

            const uploadedImage =
                await uploadImage(file);

            uploadedImages.push(
                uploadedImage
            );
        }


        // Create MongoDB documents
        const galleryDocuments =
            uploadedImages.map(
                (image) => ({
                    title,
                    description,
                    category,

                    imageUrl:
                        image.imageUrl,

                    publicId:
                        image.publicId,

                    alt,
                })
            );


        const galleries =
            await Gallery.insertMany(
                galleryDocuments
            );


        return galleries;

    } catch (error) {

        // If MongoDB creation fails,
        // remove uploaded Cloudinary images
        for (const image of uploadedImages) {

            try {

                await deleteImage(
                    image.publicId
                );

            } catch (cleanupError) {

                console.error(
                    "Cloudinary cleanup failed:",
                    cleanupError.message
                );
            }
        }


        throw error;
    }
};


// GET GALLERY

const getGallery = async (
    category = "",
    page = 1,
    limit = 12
) => {

    let filter = {};


    // Category filter
    if (category) {

        if (
            !mongoose.Types.ObjectId.isValid(
                category
            )
        ) {
            throw new ApiError(
                400,
                "Invalid gallery category ID"
            );
        }


        filter.category = category;
    }


    page = Number(page);
    limit = Number(limit);


    // Validate page
    if (
        !Number.isInteger(page) ||
        page < 1
    ) {
        throw new ApiError(
            400,
            "Page must be a positive number"
        );
    }


    // Validate limit
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


    const skip =
        (page - 1) * limit;


    const [
        galleries,
        total,
    ] = await Promise.all([

        Gallery.find(filter)
            .populate(
                "category",
                "name slug"
            )
            .sort({
                createdAt: -1,
            })
            .skip(skip)
            .limit(limit),

        Gallery.countDocuments(filter),
    ]);


    const totalPages =
        Math.ceil(total / limit);


    return {

        galleries,

        pagination: {
            total,
            page,
            limit,
            totalPages,

            hasNextPage:
                page < totalPages,

            hasPreviousPage:
                page > 1,
        },
    };
};


// UPDATE GALLERY

const updateGallery = async (
    id,
    galleryData,
    file
) => {

    // Validate ID
    if (
        !mongoose.Types.ObjectId.isValid(
            id
        )
    ) {
        throw new ApiError(
            400,
            "Invalid gallery image ID"
        );
    }


    // Find existing gallery
    const gallery =
        await Gallery.findById(id);


    if (!gallery) {
        throw new ApiError(
            404,
            "Gallery image not found"
        );
    }


    const {
        title,
        description,
        category,
        alt,
    } = galleryData;


    // CATEGORY UPDATE

    if (category) {

        const existingCategory =
            await GalleryCategory.findOne({
                _id: category,
                isActive: true,
            });


        if (!existingCategory) {

            throw new ApiError(
                404,
                "Gallery category not found or inactive"
            );
        }


        gallery.category =
            category;
    }


    // TEXT DATA UPDATE

    if (title !== undefined) {

        gallery.title =
            title;
    }


    if (
        description !== undefined
    ) {

        gallery.description =
            description;
    }


    if (alt !== undefined) {

        gallery.alt =
            alt;
    }


    // NO NEW IMAGE

    if (!file) {

        await gallery.save();

        return gallery;
    }


    // NEW IMAGE UPLOAD

    const oldPublicId =
        gallery.publicId;


    const newImage =
        await uploadImage(file);


    try {

        // Replace image information
        gallery.imageUrl =
            newImage.imageUrl;

        gallery.publicId =
            newImage.publicId;


        await gallery.save();

    } catch (error) {

        // MongoDB update failed.
        // Delete newly uploaded image.
        try {

            await deleteImage(
                newImage.publicId
            );

        } catch (cleanupError) {

            console.error(
                "New image cleanup failed:",
                cleanupError.message
            );
        }


        throw error;
    }


    // DELETE OLD IMAGE

    if (oldPublicId) {

        try {

            await deleteImage(
                oldPublicId
            );

        } catch (cleanupError) {

            console.error(
                "Old image cleanup failed:",
                cleanupError.message
            );
        }
    }


    return gallery;
};


// DELETE GALLERY

const deleteGallery = async (id) => {

    // Validate ID
    if (
        !mongoose.Types.ObjectId.isValid(
            id
        )
    ) {
        throw new ApiError(
            400,
            "Invalid gallery image ID"
        );
    }


    // Find gallery
    const gallery =
        await Gallery.findById(id);


    if (!gallery) {

        throw new ApiError(
            404,
            "Gallery image not found"
        );
    }


    // DELETE DATABASE RECORD FIRST

    await Gallery.findByIdAndDelete(
        id
    );


    // DELETE CLOUDINARY IMAGE

    if (gallery.publicId) {

        try {

            await deleteImage(
                gallery.publicId
            );

        } catch (cleanupError) {

            console.error(
                "Cloudinary cleanup failed after gallery deletion:",
                cleanupError.message
            );
        }
    }


    return gallery;
};


// EXPORT

module.exports = {

    createGallery,

    getGallery,

    updateGallery,

    deleteGallery,

};