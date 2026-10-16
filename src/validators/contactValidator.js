const Joi = require("joi");

const constactSchema = Joi.object({
    name: Joi.string().trim().min(3).max(50).required(),
    number: Joi.string().trim().pattern(/^[0-9]{10}$/),
    course: Joi.string().trim().required(),
    message: Joi.string().trim().max(1000).allow("")
})

module.exports = constactSchema