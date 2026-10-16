const ApiError = require("../utils/ApiError")

const authorize = (...allowedRoles)=>{
    return (req,res,next)=>{
        if(!req.user){
            throw new ApiError(401,"Authenticatoin Required")
        }
        if(!allowedRoles.includes(req.user.role)){
            throw new ApiError(403,"You do not have permission to perform this action")
        }
        next()
    }
}

module.exports = authorize