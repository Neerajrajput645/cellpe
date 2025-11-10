const router = require("express").Router();
const { userProfileUpload } = require("../common/fileUpload");
const { tokenVerify, adminTokenVerify } = require("../common/tokenVerify");
// const {
//   fetchFinger,
//   updateFinger,
//   createFinger,
// } = require("../controllers/auth");
const {
  referList,
  userProfile,
  updateProfile,
  createMpin,
  verifyMpin,
  forgotMpin,
  verifyOTP,
  updateMpin,
  // uplineList,
  // downlineList,
  userList,
  statusUpdate,
  serviceStatusUpdate,
} = require("../controllers/user");

// user routes
router.patch(
  "/profile-update",
  tokenVerify,
  userProfileUpload.single("avatar"),
  updateProfile
);
router.post("/list", adminTokenVerify, userList);
// router.get("/upline", tokenVerify, uplineList);
router.get("/profile", tokenVerify, userProfile);
router.get("/refer-list", tokenVerify, referList);
// router.get("/downline", tokenVerify, downlineList);
// router.get("/finger", tokenVerify, fetchFinger);
// router.post("/redeem-gift", tokenVerify, claimGiftCard);
// router.post("/finger", tokenVerify, createFinger);
// router.patch("/finger", tokenVerify, updateFinger);
router.patch("/status-update", adminTokenVerify, statusUpdate);
router.patch("/service-status-update", adminTokenVerify, serviceStatusUpdate);
// router.get("/gift-cards", tokenVerify, giftCardListsByUser);

// mpin routes
router.post("/mpin-verify", tokenVerify, verifyMpin);
router.post("/mpin-forgot", tokenVerify, forgotMpin);
router.post("/mpin-update", tokenVerify, updateMpin);
router.post("/mpin-generate", tokenVerify, createMpin);
router.post("/mpin-verify-otp", tokenVerify, verifyOTP);

module.exports = router;
