const express = require("express");

const {
    forgotPassword,
    verifyPasswordResetOtp,
    resendPasswordResetOtp,
    resetAdminPassword,
} = require("../controllers/passwordResetController");

const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.post(
    "/",
    asyncHandler(forgotPassword)
);

router.post(
    "/verify-otp",
    asyncHandler(verifyPasswordResetOtp)
);

router.post(
    "/resend-otp",
    asyncHandler(resendPasswordResetOtp)
);

router.post(
    "/reset-password",
    asyncHandler(resetAdminPassword)
);

module.exports = router;