const mongoose = require("mongoose")

const galleryCategorySchema = new mongoose.Schema({
    name:{
        type:String,
        unique:true,
        trim:true,
        required:true,
        maxlength:50,
    },
    slug:{
        type:String,
        unique:true,
        maxlength:150,
        required:true,
        trim:true,
    },
    isActive:{
        type:Boolean,
        default:true
    },

     alt:{
        type:String,
       
        trim:true,
        maxlength:150
    }
},
{timestamps:true}
)

module.exports = mongoose.model("GalleryCategory",galleryCategorySchema)