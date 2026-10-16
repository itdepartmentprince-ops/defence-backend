const Joi = require("joi");


const createGallerySchema = Joi.object({
    title: Joi.string()
        .trim()
        .max(100)
        .allow(""),

    description: Joi.string()
        .trim()
        .max(500)
        .allow(""),

    category: Joi.string()
        .required(),

    alt: Joi.string()
        .trim()
        .max(150)
        .required(),
});


const updateGallerySchema = Joi.object({
    title: Joi.string()
        .trim()
        .max(100)
        .allow(""),

    description: Joi.string()
        .trim()
        .max(500)
        .allow(""),

    category: Joi.string(),

    alt: Joi.string()
        .trim()
        .max(150)
        .allow(""),
});


module.exports = {
    createGallerySchema,
    updateGallerySchema,
};