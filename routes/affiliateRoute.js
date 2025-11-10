const router = require("express").Router();
const { affiliateImage } = require("../common/fileUpload");
const { adminTokenVerify } = require("../common/tokenVerify");
const {
  list,
  removeAffiliate,
  createAffiliate,
  updateAffiliate,
} = require("../controllers/affiliate");

router.get("/list", list);
router.delete("/remove/:affiliateId", adminTokenVerify, removeAffiliate);
router.post(
  "/create",
  adminTokenVerify,
  affiliateImage.single("image"),
  createAffiliate
);
router.patch(
  "/update/:affiliateId",
  adminTokenVerify,
  affiliateImage.single("image"),
  updateAffiliate
);

module.exports = router;
