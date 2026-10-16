const cloudinary = require("../config/cloudinary");

const uploadImage = (
    buffer,
    folder = "defence-academy/blog",
    { publicId } = {}
) => {
    return new Promise((resolve, reject) => {
        const uploadStream =
            cloudinary.uploader.upload_stream(
                {
                    folder,
                    ...(publicId ? { public_id: publicId } : {}),
                    resource_type: "image",
                },
                (error, result) => {
                    if (error) {
                        return reject(error);
                    }

                    resolve({
                        url: result.secure_url,
                        publicId: result.public_id,
                    });
                }
            );

        uploadStream.end(buffer);
    });
};

const deleteImage = async (publicId) => {
    if (!publicId) {
        return;
    }

    await cloudinary.uploader.destroy(
        publicId,
        {
            resource_type: "image",
        }
    );
};

module.exports = {
    uploadImage,
    deleteImage,
};