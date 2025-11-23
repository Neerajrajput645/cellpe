const router = require("express").Router();
const { serviceUpload } = require("../common/fileUpload");
const { adminTokenVerify } = require("../common/tokenVerify");
const {
  serviceList,
  addService,
  updateService,
  deleteService,
  // shownServices,
} = require("../controllers/service");

router.get("/list", serviceList);
// router.get("/app-list", shownServices);
router.delete("/:serviceId", adminTokenVerify, deleteService);
router.post(
  "/create",
  adminTokenVerify,
  serviceUpload.single("icon"),
  addService
);
router.patch(
  "/:serviceId",
  adminTokenVerify,
  serviceUpload.single("icon"),
  updateService
);

module.exports = router;
