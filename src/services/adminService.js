const bcrypt = require("bcrypt")

const Admin = require("../models/Admin")


const ApiError = require("../utils/ApiError")
const mongoose = require("mongoose")

const createAdmin = async (adminData) =>{
    const {name,email,password,role} = adminData

    const existingAdmin = await Admin.findOne({email})

    if(existingAdmin){
        throw new ApiError(409,"Admin with this email already exits")
    }

    const hashedPassword = await bcrypt.hash(password,12);
    
    const admin = await Admin.create({name,email,password:hashedPassword,role:"admin"})

    return admin
}


const getAdmin = async () =>{
    const admins = await Admin.find({role:"admin"})
    .select("-password -failedLoginAttempts -loginLockedUntil")
    .sort({createdAt: -1})
    return admins
}


const getAdminById = async (id) =>{

    if(!mongoose.Types.ObjectId.isValid(id)){
            throw new ApiError(400, "Invalid Update ID")
        }

        const admin = await Admin.findOne({_id:id,role:"admin"})
        .select("-password -failedLoginAttempts -loginLockedUntil")
       
        if(!admin){
            throw new ApiError(404,"Admin not Found")
        }

        return admin
}

const updateAdmin = async (id,adminData) =>{
    if(!mongoose.Types.ObjectId.isValid(id)){
        throw new ApiError(400,"Invalid Admin ID")
    }

    const admin = await Admin.findOne({_id:id,role:"admin"})

    if(!admin){
        throw new ApiError(404,"Admin Not Found")
    }

    if(adminData.email){
        const existingAdmin = await Admin.findOne({email:adminData.email,_id:{$ne:id}})

        if(existingAdmin){
            throw new ApiError(409, "Admin with this email already exist")
        }

admin.email=adminData.email
    }
    if(adminData.name){
        admin.name=adminData.name
    }

    if(adminData.password){
        admin.password = 
       await bcrypt.hash(adminData.password,12)
        admin.sessionVersion = (admin.sessionVersion || 0) + 1
    }

     await admin.save()

     return admin



}

const updateAdminIsActive = async(id,isActive)=>{

    if(!mongoose.Types.ObjectId.isValid(id)){
        throw new ApiError(400,"Invalid Admin ID")
    }

    const admin = await Admin.findOneAndUpdate(
        { _id: id, role: "admin" },
        {
            $set: { isActive },
            $inc: { sessionVersion: 1 },
        },
        { returnDocument: "after", runValidators: true }
    )

    if(!admin){
        throw new ApiError(404,"Admin not Found")
    }

    return admin

}

const deleteAdmin = async (id)=>{


    if(!mongoose.Types.ObjectId.isValid(id)){
        throw new ApiError(400,"Invalid Admin ID")
    }

    const admin = await Admin.findOneAndDelete({_id:id,role:"admin"})

    if(!admin){
        throw new ApiError(404,"Admin Not Found")
    }

    return admin
}

module.exports = {createAdmin,getAdmin,getAdminById,updateAdmin,updateAdminIsActive,deleteAdmin}