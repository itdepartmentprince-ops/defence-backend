const mongoose = require("mongoose")

const adminSchema = new mongoose.Schema({
    name:{
        type:String,
        required:true,
        trim:true
    },
    email:{
        type:String,
        required:true,
        unique:true,
        lowercase:true,
        trim:true
    },
    password:{
        type:String,
        required:true
    },
    sessionVersion:{
        type:Number,
        default:0,
        min:0
    },
    role:{
        type:String,
        enum:["superAdmin","admin"],
        default:"admin"
    },
    isActive:{
        type:Boolean,
        default:true
    },
    failedLoginAttempts:{
        type:Number,
        default:0,
        min:0
    },
    loginLockedUntil:{
        type:Date,
        default:null
    }
},{
    timestamps:true
})

module.exports = mongoose.model("Admin",adminSchema)