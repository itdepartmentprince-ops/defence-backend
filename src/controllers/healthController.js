

const getHealth = (req,res) =>{
    res.json({
        success:true,
        message:"Defence Academy Backend is Running"
    })
}

module.exports = {getHealth,};