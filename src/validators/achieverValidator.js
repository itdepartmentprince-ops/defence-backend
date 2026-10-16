
const Joi = require("joi");

const batches = ["foundation", "target"];

const createAchieverSchema = Joi.object({
    name: Joi.string().trim().min(2).max(150).required(),
    fatherName: Joi.string().trim().min(2).max(150).required(),
    address: Joi.string().trim().min(3).max(300).required(),
    examName: Joi.string().trim().min(2).max(150).required(),
    year: Joi.number().integer().min(2000).max(2100).required(),
    batch: Joi.string().trim().lowercase().valid(...batches).required(),
    isPublished: Joi.boolean().default(true),
    displayOrder: Joi.number().integer().min(0).default(0),
}).unknown(false);

const updateAchieverSchema = Joi.object({
    name: Joi.string().trim().min(2).max(150),
    fatherName: Joi.string().trim().min(2).max(150),
    address: Joi.string().trim().min(3).max(300),
    categorySlug: Joi.string().trim().lowercase().max(100),
    examName: Joi.string().trim().min(2).max(150),
    year: Joi.number().integer().min(2000).max(2100),
    batch: Joi.string().trim().lowercase().valid(...batches),
    isPublished: Joi.boolean(),
    displayOrder: Joi.number().integer().min(0),
})
    .min(1)
    .unknown(false);

const listAchieversSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(12),
    year: Joi.number().integer().min(2000).max(2100),
    batch: Joi.string().trim().lowercase().valid(...batches),
    search: Joi.string().trim().max(100).allow(""),
    sort: Joi.string()
        .valid("newest", "oldest", "name", "order")
        .default("newest"),
});

const adminListAchieversSchema = listAchieversSchema.keys({
    status: Joi.string()
        .valid("published", "draft", "all")
        .default("all"),
});

module.exports = {
    createAchieverSchema,
    updateAchieverSchema,
    listAchieversSchema,
    adminListAchieversSchema,
};
