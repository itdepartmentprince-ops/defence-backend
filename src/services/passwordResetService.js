const bcrypt = require("bcrypt");
const crypto = require("crypto");

const Admin = require("../models/Admin");
const PasswordReset = require("../models/PasswordReset");
const ApiError = require("../utils/ApiError");
const generateOtp = require("../utils/generateOtp");

const {
    sendPasswordResetOtp,
} = require("./emailService");

const normalizeEmail = (email) => {
    if (
        typeof email !== "string" ||
        !email.trim() ||
        email.length > 254
    ) {
        throw new ApiError(400, "A valid email is required");
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        throw new ApiError(400, "A valid email is required");
    }

    return normalizedEmail;
};

// Request Password Reset
const requestPasswordReset = async (email) => {
    const normalizedEmail = normalizeEmail(email);

    const admin = await Admin.findOne({
        email: normalizedEmail,
    });

    // Prevent email enumeration
    if (!admin || !admin.isActive) {
        return;
    }

    const passwordReset =
        await PasswordReset.findOne({
            adminId: admin._id,
        });

    const now = new Date();

    // Keep reset responses generic while enforcing cooldowns.
    if (
        passwordReset?.lockedUntil &&
        passwordReset.lockedUntil > now
    ) {
        return;
    }

    if (
        passwordReset?.resendAvailableAt &&
        passwordReset.resendAvailableAt > now
    ) {
        return;
    }

    const otp = generateOtp();

    const otpHash = await bcrypt.hash(
        otp,
        12
    );

    const otpExpiresAt = new Date(
        now.getTime() + 5 * 60 * 1000
    );

    const resendAvailableAt = new Date(
        now.getTime() + 60 * 1000
    );

    await PasswordReset.findOneAndUpdate(
        {
            adminId: admin._id,
        },
        {
            otpHash,
            otpExpiresAt,
            attempts: 0,
            lockedUntil: null,
            resendAvailableAt,
            resetTokenHash: null,
            resetTokenExpiresAt: null,
            verifiedAt: null,
        },
        {
            upsert: true,
            returnDocument: "after",
            setDefaultsOnInsert: true,
        }
    );

    await sendPasswordResetOtp(
        admin.email,
        otp
    );
};

// Verify OTP
const verifyOtp = async (
    email,
    otp
) => {
    if (
        typeof otp !== "string" ||
        !/^\d{6}$/.test(otp)
    ) {
        throw new ApiError(
            400,
            "Invalid or expired verification code"
        );
    }

    const normalizedEmail = normalizeEmail(email);

    const admin = await Admin.findOne({
        email: normalizedEmail,
    });

    if (!admin || !admin.isActive) {
        throw new ApiError(
            400,
            "Invalid or expired verification code"
        );
    }

    const passwordReset =
        await PasswordReset.findOne({
            adminId: admin._id,
        });

    if (!passwordReset) {
        throw new ApiError(
            400,
            "Invalid or expired verification code"
        );
    }

    const now = new Date();

    // Check 10-minute lock
    if (
        passwordReset.lockedUntil &&
        passwordReset.lockedUntil > now
    ) {
        throw new ApiError(
            400,
            "Invalid or expired verification code"
        );
    }

    // Check OTP availability and expiry
    if (
        !passwordReset.otpHash ||
        !passwordReset.otpExpiresAt ||
        passwordReset.otpExpiresAt <= now
    ) {
        throw new ApiError(
            400,
            "Invalid or expired verification code"
        );
    }

    const isOtpValid =
        await bcrypt.compare(
            otp,
            passwordReset.otpHash
        );

    // Wrong OTP
    if (!isOtpValid) {
        passwordReset.attempts += 1;

        // Lock after 5 wrong attempts
        if (passwordReset.attempts >= 5) {
            passwordReset.lockedUntil =
                new Date(
                    now.getTime() +
                    10 * 60 * 1000
                );

            passwordReset.otpHash = null;
            passwordReset.otpExpiresAt = null;

            await passwordReset.save();

            throw new ApiError(
                429,
                "Too many incorrect attempts. Please try again later."
            );
        }

        await passwordReset.save();

        throw new ApiError(
            400,
            "Invalid or expired verification code"
        );
    }

    // Generate temporary reset token
    const resetToken =
        crypto
            .randomBytes(32)
            .toString("hex");

    // Hash reset token before storing
    const resetTokenHash =
        crypto
            .createHash("sha256")
            .update(resetToken)
            .digest("hex");

    passwordReset.otpHash = null;
    passwordReset.otpExpiresAt = null;
    passwordReset.attempts = 0;
    passwordReset.verifiedAt = now;

    passwordReset.resetTokenHash =
        resetTokenHash;

    passwordReset.resetTokenExpiresAt =
        new Date(
            now.getTime() +
            10 * 60 * 1000
        );

    await passwordReset.save();

    return {
        resetToken,
    };
};

// Resend OTP
const resendOtp = async (email) => {
    const normalizedEmail = normalizeEmail(email);

    const admin = await Admin.findOne({
        email: normalizedEmail,
    });

    // Prevent email enumeration
    if (!admin || !admin.isActive) {
        return;
    }

    const passwordReset =
        await PasswordReset.findOne({
            adminId: admin._id,
        });

    // No previous reset request
    if (!passwordReset) {
        return;
    }

    const now = new Date();

    // Check 10-minute lock
    if (
        passwordReset.lockedUntil &&
        passwordReset.lockedUntil > now
    ) {
        return;
    }

    // Check 60-second resend cooldown
    if (
        passwordReset.resendAvailableAt &&
        passwordReset.resendAvailableAt > now
    ) {
        return;
    }

    const otp = generateOtp();

    const otpHash = await bcrypt.hash(
        otp,
        12
    );

    const otpExpiresAt = new Date(
        now.getTime() + 5 * 60 * 1000
    );

    const resendAvailableAt = new Date(
        now.getTime() + 60 * 1000
    );

    // Replace old OTP and reset state
    passwordReset.otpHash = otpHash;
    passwordReset.otpExpiresAt =
        otpExpiresAt;

    passwordReset.attempts = 0;
    passwordReset.lockedUntil = null;

    passwordReset.resendAvailableAt =
        resendAvailableAt;

    // Old reset token becomes invalid
    passwordReset.resetTokenHash = null;
    passwordReset.resetTokenExpiresAt = null;
    passwordReset.verifiedAt = null;

    await passwordReset.save();

    await sendPasswordResetOtp(
        admin.email,
        otp
    );
};

const resetPassword = async (
    email,
    resetToken,
    newPassword
) => {
    if (
        typeof resetToken !== "string" ||
        !/^[a-f0-9]{64}$/i.test(resetToken)
    ) {
        throw new ApiError(
            400,
            "Invalid or expired reset token"
        );
    }

    if (
        typeof newPassword !== "string" ||
        newPassword.length < 12 ||
        Buffer.byteLength(newPassword, "utf8") > 72
    ) {
        throw new ApiError(
            400,
            "Password must be at least 12 characters and no more than 72 bytes"
        );
    }

    const normalizedEmail = normalizeEmail(email);

    const admin = await Admin.findOne({
        email: normalizedEmail,
    });

    if (!admin || !admin.isActive) {
        throw new ApiError(
            400,
            "Invalid or expired reset token"
        );
    }

    const passwordReset =
        await PasswordReset.findOne({
            adminId: admin._id,
        });

    if (!passwordReset) {
        throw new ApiError(
            400,
            "Invalid or expired reset token"
        );
    }

    const now = new Date();

    if (
        !passwordReset.resetTokenHash ||
        !passwordReset.resetTokenExpiresAt ||
        passwordReset.resetTokenExpiresAt <= now
    ) {
        throw new ApiError(
            400,
            "Invalid or expired reset token"
        );
    }

    const resetTokenHash =
        crypto
            .createHash("sha256")
            .update(resetToken)
            .digest("hex");

    const storedTokenHash =
        passwordReset.resetTokenHash;
    const providedTokenHashBuffer =
        Buffer.from(resetTokenHash, "hex");
    const storedTokenHashBuffer =
        Buffer.from(storedTokenHash, "hex");

    if (
        storedTokenHashBuffer.length !== providedTokenHashBuffer.length ||
        !crypto.timingSafeEqual(
            providedTokenHashBuffer,
            storedTokenHashBuffer
        )
    ) {
        throw new ApiError(
            400,
            "Invalid or expired reset token"
        );
    }

    const hashedPassword =
        await bcrypt.hash(
            newPassword,
            12
        );

    admin.password = hashedPassword;
    admin.sessionVersion = (admin.sessionVersion || 0) + 1;

    await admin.save();

    // Invalidate password reset
    passwordReset.otpHash = null;
    passwordReset.otpExpiresAt = null;
    passwordReset.attempts = 0;
    passwordReset.lockedUntil = null;
    passwordReset.resendAvailableAt = null;
    passwordReset.resetTokenHash = null;
    passwordReset.resetTokenExpiresAt = null;
    passwordReset.verifiedAt = null;

    await passwordReset.save();
};

module.exports = {
    requestPasswordReset,
    verifyOtp,
    resendOtp,
    resetPassword,
};