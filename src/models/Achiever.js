
const mongoose = require("mongoose");

const achieverSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Student name is required"],
            trim: true,
            maxlength: 150,
        },
        fatherName: {
            type: String,
            required: [true, "Father name is required"],
            trim: true,
            maxlength: 150,
        },
        address: {
            type: String,
            required: [true, "Address is required"],
            trim: true,
            maxlength: 300,
        },
        categoryId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "AchieverCategory",
            required: [true, "Student category is required"],
            index: true,
        },
        examName: {
            type: String,
            required: [true, "Exam name is required"],
            trim: true,
            maxlength: 150,
        },
        year: {
            type: Number,
            required: [true, "Year is required"],
            min: 2000,
            max: 2100,
        },
        batch: {
            type: String,
            required: [true, "Batch is required"],
            enum: ["foundation", "target"],
        },
        photo: {
            url: {
                type: String,
                required: [true, "Student photo URL is required"],
            },
            publicId: {
                type: String,
                required: [true, "Student photo public ID is required"],
            },
        },
        isPublished: {
            type: Boolean,
            default: true,
        },
        displayOrder: {
            type: Number,
            default: 0, 
        },
    },
    {
        timestamps: true,
    }
);

achieverSchema.index({
    categoryId: 1,
    isPublished: 1,
    year: -1,
});

module.exports = mongoose.model("Achiever", achieverSchema);
