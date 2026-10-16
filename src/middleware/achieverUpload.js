
const upload = require("./uploadMiddleware");


const achieverUpload = upload.single("photo");

module.exports = achieverUpload;
