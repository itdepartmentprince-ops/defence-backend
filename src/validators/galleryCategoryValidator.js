const Joi = require("joi");

const createGalleryCategorySchema = Joi.object({
    name: Joi.string()
        .trim()
        .min(2)
        .max(50)
        .required(),
});

const updateGalleryCategorySchema = Joi.object({
    name: Joi.string()
        .trim()
        .min(2)
        .max(50)
        .required(),
});

const updateGalleryCategoryStatusSchema = Joi.object({
    isActive: Joi.boolean().required(),
});

module.exports = {
    createGalleryCategorySchema,
    updateGalleryCategorySchema,
    updateGalleryCategoryStatusSchema,
};