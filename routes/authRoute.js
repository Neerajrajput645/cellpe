const router = require("express").Router();
const { tokenVerify, adminTokenVerify } = require("../common/tokenVerify");
const { shopBannerUpload } = require("../common/fileUpload");
const { userSignUp,logout } = require("../controllers/auth");

router.post("/user-register", userSignUp); // new route to signup
router.post("/logout", tokenVerify, logout); // new route to logout

module.exports = router;
