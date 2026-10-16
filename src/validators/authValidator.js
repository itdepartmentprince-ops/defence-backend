const Joi = require("joi")

const loginSchema = Joi.object({
    email: Joi.string().email().required().trim(),
    password: Joi.string().required()
})

module.exports = loginSchema