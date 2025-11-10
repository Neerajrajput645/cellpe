const router = require("express").Router();
const { tokenVerify, adminTokenVerify } = require("../common/tokenVerify");
const { shopBannerUpload } = require("../common/fileUpload");
const { userSignUp } = require("../controllers/auth");

router.post("/user-register", userSignUp); // new route to signup

module.exports = router;
