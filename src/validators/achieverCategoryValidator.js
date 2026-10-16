
const Joi = require("joi");

const createCategorySchema = Joi.object({
    name: Joi.string().trim().min(2).max(100).required(),
    isActive: Joi.boolean().optional(),
});

const updateCategorySchema = Joi.object({
    name: Joi.string().trim().min(2).max(100),
    isActive: Joi.boolean(),
}).min(1);

module.exports = {
    createCategorySchema,
    updateCategorySchema,
};
