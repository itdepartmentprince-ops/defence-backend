const mongoose = require("mongoose");

const googleTokenSchema = new mongoose.Schema(
    {
        provider: {
            type: String,
            required: true,
            unique: true,
            default: "google-business",
        },

        accessToken: {
            type: String,
            required: true,
        },

        refreshToken: {
            type: String,
            required: true,
        },

        expiryDate: {
            type: Date,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model(
    "GoogleToken",
    googleTokenSchema
);