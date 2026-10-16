const Joi = require("joi")

const createAdminSchema = Joi.object({
    name: Joi.string().trim().min(2).max(50).required(),
    email:Joi.string().trim().required().lowercase().email(),
    password: Joi.string().trim().min(8).max(50).required(),
    role: Joi.string().valid("admin").default("admin")
})

const updateAdminSchema = Joi.object({
    name: Joi.string().trim().min(3).max(50),
    email:Joi.string().trim().lowercase().email(),
    password:Joi.string().trim().min(8).max(50)
}).min(1);

const updateAdminStatusSchema = Joi.object({
    isActive: Joi.boolean().required()
})


module.exports = {createAdminSchema, updateAdminSchema,updateAdminStatusSchema}