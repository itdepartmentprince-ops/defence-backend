const mongoose = require("mongoose");

const passwordResetSchema =
    new mongoose.Schema(
        {
            adminId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Admin",
                required: true,
                unique: true,
                index: true,
            },

            otpHash: {
                type: String,
                default: null,
            },

            otpExpiresAt: {
                type: Date,
                default: null,
            },

            attempts: {
                type: Number,
                default: 0,
            },

            lockedUntil: {
                type: Date,
                default: null,
            },

            resendAvailableAt: {
                type: Date,
                default: null,
            },

            resetTokenHash: {
                type: String,
                default: null,
            },

            resetTokenExpiresAt: {
                type: Date,
                default: null,
            },

            verifiedAt: {
                type: Date,
                default: null,
            },
        },
        {
            timestamps: true,
        }
    );

module.exports =
    mongoose.model(
        "PasswordReset",
        passwordResetSchema
    );