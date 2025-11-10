const router = require("express").Router();
const { tokenVerify, adminTokenVerify } = require("../common/tokenVerify");
const {
  Recharge_CallBack_Handler,
} = require("../controllers/services/recharge");
const {
  userCheck,
   sendMoney,
  getWalletByUser,
  addMoney,
  donateMoney,
} = require("../controllers/wallet");

router.get("/info", tokenVerify, getWalletByUser);
// router.all("/callback", Recharge_CallBack_Handler);
router.post("/add-money", tokenVerify, addMoney); // temperary
router.post("/user-exist", tokenVerify, userCheck);
router.post("/send-money", tokenVerify, sendMoney);
// router.get("/withdraw-request-list", tokenVerify, withdrwRequestList);
// router.post("/withdraw-request", tokenVerify, withdrawRequest);
// router.post("/manage-withdraw-request", adminTokenVerify, manageWithdrwRequest);
// router.get(
//   "/withdraw-request-list-admin",
//   adminTokenVerify,
//   withdrwRequestListByAdmin
// );

router.post("/donate", tokenVerify, donateMoney); // temperary

module.exports = router;
