const { tokenVerify, adminTokenVerify } = require("../common/tokenVerify");
const {
  notificationList,
  pushNotification,
  notificationListByUser,
} = require("../controllers/notification");

const router = require("express").Router();

router.get("/list/admin", adminTokenVerify, notificationList);
router.get("/list", tokenVerify, notificationListByUser);
router.post("/push", adminTokenVerify, pushNotification);

module.exports = router;
