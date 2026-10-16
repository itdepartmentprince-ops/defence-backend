const mongoose = require("mongoose")

const contactShema = new mongoose.Schema({
    name:{
        type:String,
        required: true
    },
    number:{
        type:String,
        required:true
    },
    course:{
        type:String,
        required:true
    },
    message:{
        type:String,
        required:true
    },
    status:{
        type:String,
        enum:["new","open","closed"],
        default:"new"
    }
},{

        timestamps:true
    }
)

module.exports = mongoose.model("Contact",contactShema)