const express = require("express")
const {addAdmin,fetchAdmin,fetchAdminById,editAdmin,editAdminIsActive,removeAdmin}= require("../controllers/adminController")
const validate = require("../middleware/validateMiddleware")
const asyncHandler = require("../utils/asyncHandler")
const authMiddleware = require("../middleware/authMiddleware")
const authorize = require("../middleware/roleMiddleware")
const {createAdminSchema,updateAdminSchema,updateAdminStatusSchema} = require("../validators/adminValidator")

const router = express.Router()

router.post("/",authMiddleware,authorize("superAdmin"),validate(createAdminSchema),asyncHandler(addAdmin))
router.get("/",authMiddleware,authorize("superAdmin"),asyncHandler(fetchAdmin))
router.get("/:id",authMiddleware,authorize("superAdmin"),asyncHandler(fetchAdminById))
router.put("/:id",authMiddleware,authorize("superAdmin"),validate(updateAdminSchema),asyncHandler(editAdmin))
router.patch("/:id",authMiddleware,authorize("superAdmin"),validate(updateAdminStatusSchema),asyncHandler(editAdminIsActive))
router.delete("/:id",authMiddleware,authorize("superAdmin"),asyncHandler(removeAdmin))


module.exports = router