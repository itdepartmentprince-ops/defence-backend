const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const ApiError = require("../utils/ApiError");

const authMiddleware = async (req, res, next) => {
    try {
        // 1. GET TOKEN FROM COOKIE

        const token = req.cookies?.accessToken;

        if (!token) {
            throw new ApiError(
                401,
                "Authentication Required"
            );
        }


        // 2. VERIFY JWT TOKEN

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );


        // 3. CHECK USER ID

        if (!decoded?.id) {
            throw new ApiError(
                401,
                "Invalid authentication token"
            );
        }


        // 4. FIND ADMIN IN DATABASE

        const admin = await Admin.findById(
            decoded.id
        ).select("-password");

        if (!admin) {
            throw new ApiError(
                401,
                "Admin account not found"
            );
        }

        if ((decoded.sessionVersion ?? 0) !== (admin.sessionVersion ?? 0)) {
            throw new ApiError(
                401,
                "Authentication session has been revoked"
            );
        }


        // 5. CHECK ADMIN STATUS

        if (!admin.isActive) {
            throw new ApiError(
                401,
                "Your account is inactive"
            );
        }


        // 6. ATTACH CURRENT ADMIN TO REQUEST

        req.user = {
            id: admin._id,
            name: admin.name,
            email: admin.email,
            role: admin.role,
            isActive: admin.isActive,
        };
        req.csrfToken = decoded.csrfToken;


        // 7. CONTINUE

        next();

    } catch (error) {

        // JWT ERROR

        if (error.name === "JsonWebTokenError") {
            return next(
                new ApiError(
                    401,
                    "Invalid authentication token"
                )
            );
        }


        // EXPIRED JWT

        if (error.name === "TokenExpiredError") {
            return next(
                new ApiError(
                    401,
                    "Authentication token expired"
                )
            );
        }


        // OTHER ERRORS

        next(error);
    }
};

module.exports = authMiddleware;