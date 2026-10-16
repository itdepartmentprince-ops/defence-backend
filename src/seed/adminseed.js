require("dotenv").config(); 
const bcrypt = require("bcrypt"); 
const Admin = require("../models/Admin"); 
const connectDB = require("../config/db"); 

const createSuperAdmin = async () => { 
  try { 
    await connectDB(); 

    const existingSuperAdmin = await Admin.findOne({ role: "superAdmin" }); 

    if (existingSuperAdmin) { 
      console.log("Super Admin Already Exists"); 
      process.exit(0);
    } 

    const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12); 

    const admin = await Admin.create({ 
      name: "Prince", 
      email: "princewebdev63@gmail.com",
      role: "superAdmin", 
      password: hashedPassword 
    }); 

    console.log("SuperAdmin Created Successfully"); 
    process.exit(0); 
  } catch (error) { 
    console.error("SuperAdmin creation failed:", error.message); 
    process.exit(1); 
  } 
}; 

createSuperAdmin();
