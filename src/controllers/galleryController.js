const {
    createGallery,
    getGallery,
    deleteGallery,
    updateGallery,
} = require("../services/galleryService");


// CREATE GALLERY

const uploadGalleryImages = async (
    req,
    res
) => {

    const galleries =
        await createGallery(
            req.body,
            req.files
        );


    res.status(201).json({
        success: true,

        message:
            "Gallery images uploaded successfully",

        data: galleries,
    });
};


// GET GALLERY

const fetchGallery = async (
    req,
    res
) => {

    const {
        category,
        page = 1,
        limit = 12,
    } = req.query;


    const result =
        await getGallery(
            category,
            page,
            limit
        );


    res.status(200).json({

        success: true,

        message:
            "Gallery fetched successfully",

        data:
            result.galleries,

        pagination:
            result.pagination,
    });
};


// UPDATE GALLERY

const editGallery = async (
    req,
    res
) => {

    const gallery =
        await updateGallery(
            req.params.id,
            req.body,
            req.file
        );


    res.status(200).json({

        success: true,

        message:
            "Gallery image updated successfully",

        data: gallery,
    });
};


// DELETE GALLERY

const removeGallery = async (
    req,
    res
) => {

    const gallery =
        await deleteGallery(
            req.params.id
        );


    res.status(200).json({

        success: true,

        message:
            "Gallery image deleted successfully",

        data: {
            id: gallery._id,

            title:
                gallery.title,

            description:
                gallery.description,

            imageUrl:
                gallery.imageUrl,

            publicId:
                gallery.publicId,
        },
    });
};


// EXPORT

module.exports = {

    uploadGalleryImages,

    fetchGallery,

    editGallery,

    removeGallery,

};