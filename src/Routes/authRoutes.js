const express = require("express")
const {loginAdmin,getme,getCsrfToken,logoutAdmin} = require("../controllers/authController")
const asyncHandler = require("../utils/asyncHandler")
const authMiddleware = require("../middleware/authMiddleware")
const authorize = require("../middleware/roleMiddleware")
const validate = require("../middleware/validateMiddleware")
const loginSchema = require("../validators/authValidator")

const router = express.Router()

router.post("/login",validate(loginSchema),asyncHandler(loginAdmin))
router.get("/me",authMiddleware,authorize("superAdmin","admin"),getme)
router.get("/csrf",authMiddleware,authorize("superAdmin","admin"),getCsrfToken)
router.post("/logout", authMiddleware, asyncHandler(logoutAdmin));

module.exports = router