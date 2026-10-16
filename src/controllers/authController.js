const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { randomBytes } = require("crypto");

const Admin = require("../models/Admin");
const ApiError = require("../utils/ApiError");

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_DURATION_MS = 15 * 60 * 1000;

const getUnlockedAccountFilter = (adminId, now) => ({
    _id: adminId,
    $or: [
        { loginLockedUntil: null },
        { loginLockedUntil: { $exists: false } },
        { loginLockedUntil: { $lte: now } },
    ],
});

const recordFailedLogin = async (adminId, now) =>
    Admin.findOneAndUpdate(
        getUnlockedAccountFilter(adminId, now),
        [
            {
                $set: {
                    failedLoginAttempts: {
                        $add: [
                            {
                                $ifNull: [
                                    "$failedLoginAttempts",
                                    0,
                                ],
                            },
                            1,
                        ],
                    },
                },
            },
            {
                $set: {
                    loginLockedUntil: {
                        $cond: [
                            {
                                $gte: [
                                    "$failedLoginAttempts",
                                    MAX_FAILED_LOGIN_ATTEMPTS,
                                ],
                            },
                            new Date(
                                now.getTime() +
                                    LOGIN_LOCK_DURATION_MS
                            ),
                            null,
                        ],
                    },
                },
            },
        ],
        { returnDocument: "after" }
    );

// LOGIN ADMIN

const loginAdmin = async (req, res) => {
    const { email, password } = req.body;
    const now = new Date();


    // FIND ADMIN

    const admin = await Admin.findOne({
        email: email.trim().toLowerCase(),
    });

    if (!admin) {
        throw new ApiError(
            401,
            "Email and Password incorrect"
        );
    }


    // CHECK ACTIVE STATUS

    if (!admin.isActive) {
        throw new ApiError(
            401,
            "Your Account is Inactive"
        );
    }

    if (
        admin.loginLockedUntil &&
        admin.loginLockedUntil > now
    ) {
        const retryAfterSeconds = Math.ceil(
            (admin.loginLockedUntil.getTime() - now.getTime()) /
                1000
        );

        res.set("Retry-After", String(retryAfterSeconds));
        throw new ApiError(
            429,
            "Too many failed login attempts. Please try again after 15 minutes."
        );
    }


    // CHECK PASSWORD

    const isPasswordValid =
        await bcrypt.compare(
            password,
            admin.password
        );

    if (!isPasswordValid) {
        const updatedAdmin = await recordFailedLogin(
            admin._id,
            now
        );

        if (
            !updatedAdmin &&
            admin.loginLockedUntil &&
            admin.loginLockedUntil > now
        ) {
            const retryAfterSeconds = Math.ceil(
                (admin.loginLockedUntil.getTime() - now.getTime()) /
                    1000
            );

            res.set("Retry-After", String(retryAfterSeconds));
            throw new ApiError(
                429,
                "Too many failed login attempts. Please try again after 15 minutes."
            );
        }

        if (
            updatedAdmin?.loginLockedUntil &&
            updatedAdmin.loginLockedUntil > now
        ) {
            const retryAfterSeconds = Math.ceil(
                (updatedAdmin.loginLockedUntil.getTime() - now.getTime()) /
                    1000
            );

            res.set("Retry-After", String(retryAfterSeconds));
            throw new ApiError(
                429,
                "Too many failed login attempts. Please try again after 15 minutes."
            );
        }

        throw new ApiError(
            401,
            "Email or password is incorrect"
        );
    }

    const unlockedAdmin = await Admin.findOneAndUpdate(
        getUnlockedAccountFilter(admin._id, now),
        {
            $set: {
                failedLoginAttempts: 0,
                loginLockedUntil: null,
            },
        },
        { returnDocument: "after" }
    );

    if (!unlockedAdmin) {
        throw new ApiError(
            429,
            "Too many failed login attempts. Please try again after 15 minutes."
        );
    }


    // CREATE JWT

    const csrfToken = randomBytes(32).toString("hex");
    const token = jwt.sign(
        {
            id: unlockedAdmin._id,
            role: unlockedAdmin.role,
            csrfToken,
            sessionVersion: unlockedAdmin.sessionVersion || 0,
        },
        process.env.JWT_SECRET,
        {
            expiresIn:
                process.env.JWT_EXPIRES_IN || "7d",
        }
    );


    // SET COOKIE

    res.cookie(
        "accessToken",
        token,
        {
            httpOnly: true,

            secure:
                process.env.NODE_ENV ===
                "production",

            sameSite:
                process.env.NODE_ENV ===
                "production"
                    ? "none"
                    : "lax",

            maxAge:
                7 *
                24 *
                60 *
                60 *
                1000,

            path: "/",
        }
    );


    // RESPONSE

    res.status(200).json({
        success: true,
        message: "Login Successful",

        data: {
            admin: {
                id: unlockedAdmin._id,
                name: unlockedAdmin.name,
                email: unlockedAdmin.email,
                role: unlockedAdmin.role,
            },
        },
    });
};


// GET CURRENT ADMIN

const getme = (req, res) => {
    res.status(200).json({
        success: true,
        message: "Authenticated User",

        data: {
            user: req.user,
        },
    });
};

const getCsrfToken = (req, res) => {
    if (!req.csrfToken) {
        throw new ApiError(401, "Please log in again to continue");
    }

    res.status(200).json({
        success: true,
        data: {
            csrfToken: req.csrfToken,
        },
    });
};


// LOGOUT ADMIN

const logoutAdmin = (req, res) => {
    res.clearCookie(
        "accessToken",
        {
            httpOnly: true,

            secure:
                process.env.NODE_ENV ===
                "production",

            sameSite:
                process.env.NODE_ENV ===
                "production"
                    ? "none"
                    : "lax",

            path: "/",
        }
    );


    res.status(200).json({
        success: true,
        message: "Logout Successful",
    });
};


module.exports = {
    loginAdmin,
    getme,
    getCsrfToken,
    logoutAdmin,
};