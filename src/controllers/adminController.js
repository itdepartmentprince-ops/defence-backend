
const { json } = require("express")
const {createAdmin,getAdmin,getAdminById,updateAdmin, updateAdminIsActive,deleteAdmin} = require("../services/adminService")




const addAdmin = async (req,res)=>{
    const admin = await createAdmin(req.body)

    res.status(201).json({
        success:true,
        message:"Admin Created Successfully",
        data:{
            id:admin._id,
            name:admin.name,
            email:admin.email,
            role:admin.role,
            isActive:admin.isActive,
            createdAt:admin.createdAt,
        }
    })
}

const fetchAdmin = async (req,res)=>{
    const admins = await getAdmin()
    
    res.status(200).json({
        success:true,
        message:"Admins Fetch Successfully",
        data:admins
    })
}

const fetchAdminById = async (req,res) =>{


   
    const admin = await getAdminById(req.params.id)
   

    res.status(200).json({
        success:true,
        message:"Admin Fetch Successfully",
        data:admin
    })
}

const editAdmin = async (req,res) =>{

    const admin = await updateAdmin(req.params.id,req.body)

    res.status(200).json({
        success:true,
        message:"Admin Updated Successfully",
        data:{
            id:admin._id,
            name:admin.name,
            email:admin.email,
            role:admin.role,
            isActive:admin.isActive,
            createdAt:admin.createdAt,
            updatedAt:admin.updatedAt
        }
    })

}

const editAdminIsActive = async(req,res)=>{
  
  
    const admin = await updateAdminIsActive(req.params.id,req.body.isActive)

    res.status(200).json({
        success:true,
        message:"Admin Status Updated Successfully",
        data:{
            id:admin._id,
            name:admin.name,
            email:admin.email,
            role:admin.role,
            isActive:admin.isActive,
            
        }
    })
}

const removeAdmin = async(req,res)=>{
    
    const admin = await deleteAdmin(req.params.id)
   

    res.status(200).json({
        success:true,
        message:"Admin Deleted Successfully",
        data:{
            id:admin._id,
            name:admin.name,
            email:admin.email
          
        }
    })
}




module.exports = {addAdmin,fetchAdmin,fetchAdminById,editAdmin,editAdminIsActive,removeAdmin}