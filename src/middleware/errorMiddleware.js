const multer = require("multer");

const errorMiddleware = (
    err,
    req,
    res,
    next
) => {
    console.error(
        "ERROR:",
        err
    );

    if (
        err instanceof multer.MulterError
    ) {
        if (
            err.code ===
            "LIMIT_FILE_SIZE"
        ) {
            return res.status(400).json({
                success: false,
                message:
                    err.field === "file"
                        ? "Word document size must not exceed 5 MB"
                        : "Image size must not exceed 5 MB",
            });
        }

        if (
            err.code ===
            "LIMIT_FILE_COUNT"
        ) {
            return res.status(400).json({
                success: false,
                message:
                    err.field === "file"
                        ? "Upload only one Word document"
                        : "Maximum 21 images are allowed",
            });
        }

        if (
            err.code ===
            "LIMIT_UNEXPECTED_FILE"
        ) {
            return res.status(400).json({
                success: false,
                message:
                    err.field === "file"
                        ? "Unexpected Word document field"
                        : "Unexpected image field",
            });
        }

        return res.status(400).json({
            success: false,
            message: err.message,
        });
    }

    if (
        err.message === "Only JPG, PNG, WEBP and AVIF images are allowed" ||
        err.message === "Upload a valid .docx Word document."
    ) {
        return res.status(400).json({
            success: false,
            message: err.message,
        });
    }

    const statusCode =
        err.statusCode || 500;

    const message =
        statusCode === 500
            ? "Internal Server Error"
            : err.message;

    res.status(statusCode).json({
        success: false,
        message,
    });
};

module.exports =
    errorMiddleware;