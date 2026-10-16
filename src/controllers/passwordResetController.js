const {
    requestPasswordReset,
    verifyOtp,
    resendOtp,
    resetPassword,
} = require("../services/passwordResetService");

const forgotPassword = async (req, res) => {
    const { email } = req.body || {};

    await requestPasswordReset(email);

    res.status(200).json({
        success: true,
        message:
            "If an account exists with this email, a verification code has been sent.",
    });
};

const verifyPasswordResetOtp = async (
    req,
    res
) => {
    const { email, otp } = req.body || {};

    const result = await verifyOtp(
        email,
        otp
    );

    res.status(200).json({
        success: true,
        message: "OTP verified successfully",
        data: {
            resetToken: result.resetToken,
        },
    });
};

const resendPasswordResetOtp = async (
    req,
    res
) => {
    const { email } = req.body || {};

    await resendOtp(email);

    res.status(200).json({
        success: true,
        message:
            "If an account exists with this email, a verification code has been sent.",
    });
};

const resetAdminPassword = async (
    req,
    res
) => {
    const {
        email,
        resetToken,
        newPassword,
    } = req.body || {};

    await resetPassword(
        email,
        resetToken,
        newPassword
    );

    res.status(200).json({
        success: true,
        message:
            "Password reset successfully",
    });
};

module.exports = {
    forgotPassword,
    verifyPasswordResetOtp,
    resendPasswordResetOtp,
    resetAdminPassword,
};