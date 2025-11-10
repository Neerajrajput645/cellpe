const router = require("express").Router();
const {
  ipList,
  newIp,
  updateIp,
  removeIp,
  updateIpStatus,
} = require("../controllers/ipController");

const {tokenVerify} = require("../common/tokenVerify");
router.get("/list", ipList);
router.post("/new", tokenVerify, newIp);
router.patch("/update/:ipId", tokenVerify, updateIp);
router.delete("/remove/:ipId", tokenVerify, removeIp);
router.patch("/update-status/:ipId", tokenVerify, updateIpStatus);

module.exports = router;
