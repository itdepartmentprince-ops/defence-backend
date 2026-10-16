const cloudinary = require("../config/cloudinary");
const ApiError = require("../utils/ApiError");

const uploadImage = (file) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: "defence-academy/gallery",
                resource_type: "image",
            },
            (error, result) => {
                if (error) {
                    return reject(
                        new ApiError(
                            500,
                            "Image upload failed"
                        )
                    );
                }

                resolve({
                    imageUrl: result.secure_url,
                    publicId: result.public_id,
                });
            }
        );

        uploadStream.end(file.buffer);
    });
};

const deleteImage = async (publicId) => {
    const result = await cloudinary.uploader.destroy(
        publicId,
        {
            resource_type: "image",
        }
    );

    if (result.result !== "ok") {
        throw new ApiError(
            500,
            "Image deletion failed"
        );
    }

    return result;
};

module.exports = {
    uploadImage,
    deleteImage,
};