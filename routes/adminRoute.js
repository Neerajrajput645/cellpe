const router = require("express").Router();
const { adminTokenVerify } = require("../common/tokenVerify");
const {
  adminLogin,
  adminProfile,
  adminRegister,
  MpinView,
  otpList,
  AddReferToUser,
} = require("../controllers/admin");
const { txnList } = require("../controllers/adminTxn");
// const { giftCardLists } = require("../controllers/user");
const { manageMoney } = require("../controllers/wallet");

// routes
// router.post("/forgot-password");
router.post("/login", adminLogin);
router.post("/register", adminRegister);
router.get("/txn-list", adminTokenVerify, txnList);
router.get("/profile", adminTokenVerify, adminProfile);
router.post("/send", adminTokenVerify, manageMoney);
router.post("/mpin-view", adminTokenVerify, MpinView);
router.post("/add-refer", adminTokenVerify, AddReferToUser);

// router.get("/gift-cards", adminTokenVerify, giftCardLists);
router.get("/otp-get", adminTokenVerify, otpList);

module.exports = router;
