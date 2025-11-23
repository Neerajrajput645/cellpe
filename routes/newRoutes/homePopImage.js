const router = require("express").Router();
const { homeBannerImages } = require("../../common/fileUpload");
const {
    getHomePopImage,
    getHomePopImagesAdmin,
    // createHomePopImage,
    updateHomePopImage,
    // deleteHomePopImage,
} = require("../../controllers/newControllers/homePopImage");
const { adminTokenVerify, tokenVerify } = require("../../common/tokenVerify");

router.get("/", tokenVerify, getHomePopImage);
router.get("/admin/list", adminTokenVerify, getHomePopImagesAdmin);
// router.post("/create", adminTokenVerify, homeBannerImages.single("image"), createHomePopImage);
router.put("/update", adminTokenVerify, homeBannerImages.single("image"), updateHomePopImage);
// router.delete("/:bannerId", adminTokenVerify, deleteHomePopImage);
module.exports = router;
