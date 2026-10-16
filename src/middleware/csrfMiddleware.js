const { timingSafeEqual } = require("crypto");
const ApiError = require("../utils/ApiError");

const getTrustedOrigins = () => {
    const configuredOrigins = process.env.CSRF_TRUSTED_ORIGINS;

    const defaultOrigins = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "https://prince-defence-frontend.vercel.app",
        "https://prince-defence-admin.vercel.app",
    ];

    const additionalOrigins = configuredOrigins
        ? configuredOrigins.split(",")
        : [];

    return [...new Set([...defaultOrigins, ...additionalOrigins]
        .map((origin) => origin.trim().replace(/\/+$/, ""))
        .filter(Boolean))];
};

const csrfMiddleware = (req, res, next) => {
    const origin = req.get("Origin");
    const trustedOrigins = getTrustedOrigins();

    if (!origin || !trustedOrigins.includes(origin)) {
        return next(new ApiError(403, "Request origin is not allowed"));
    }

    const expectedToken = req.csrfToken;
    const suppliedToken = req.get("X-CSRF-Token");

    if (
        typeof expectedToken !== "string" ||
        typeof suppliedToken !== "string"
    ) {
        return next(new ApiError(403, "A valid CSRF token is required"));
    }

    const expectedBuffer = Buffer.from(expectedToken);
    const suppliedBuffer = Buffer.from(suppliedToken);

    if (
        expectedBuffer.length !== suppliedBuffer.length ||
        !timingSafeEqual(expectedBuffer, suppliedBuffer)
    ) {
        return next(new ApiError(403, "A valid CSRF token is required"));
    }

    next();
};

module.exports = csrfMiddleware;
