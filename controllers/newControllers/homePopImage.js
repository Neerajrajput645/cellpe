const HomePopImage = require("../../models/newModels/homePopImage");
const asyncHandler = require("express-async-handler");
const successHandler = require("../../common/successHandler");
const deletePreviousImage = require("../../common/deletePreviousImage");

// ⭐ GET ALL BANNERS
const getHomePopImage = asyncHandler(async (req, res) => {
    
    const image = await HomePopImage.findOne({status: true}).sort({ createdAt: -1 }).select("image link");
    console.log(image);
    if (!image) {
        res.status(404);
        throw new Error("Home pop image not found");
    }
    successHandler(req, res, {
        Remarks: "Home pop images fetched successfully",
        Data: image,
    });
});

// ⭐ GET ALL BANNERS
const getHomePopImagesAdmin = asyncHandler(async (req, res) => {
    const all = await HomePopImage.findOne().sort({ createdAt: -1 });

    successHandler(req, res, {
        Remarks: "Home pop images fetched successfully",
        Data: all,
    });
});

// // ⭐ CREATE BANNER
// const createHomePopImage = asyncHandler(async (req, res) => {
//     const { image, link } = req.body;
//     const newBanner = new HomePopImage({
//         link,
//         image: req?.file?.path,
//         status: true,
//     });

//     const saved = await HomePopImage.create(newBanner);

//     successHandler(req, res, {
//         Remarks: "Home pop image created successfully",
//         Data: saved,
//     });
// });

// ⭐ UPDATE BANNER
const updateHomePopImage = asyncHandler(async (req, res) => {
    // Fetch existing record
    const existing = await HomePopImage.findOne();
    if (!existing) {
        res.status(404);
        throw new Error("Home pop image record not found");
    }

    // Delete old image if new image uploaded
    if (req.file && existing.image) {
        deletePreviousImage(existing.image);
    }

    // Prepare update payload
    const payload = {
        link: req.body.link || existing.link,
        image: req.file ? req.file.path : existing.image,
    };

    // Update record
    const updated = await HomePopImage.findByIdAndUpdate(
        existing._id,
        payload,
        { new: true }
    );

    return successHandler(req, res, {
        Remarks: "Home pop image updated successfully",
        Data: updated,
    });
});


// // ⭐ DELETE BANNER
// const deleteHomePopImage = asyncHandler(async (req, res) => {
//     const { bannerId } = req.params;

//     const found = await HomePopImage.findById(bannerId);
//     if (!found) {
//         res.status(400);
//         throw new Error("Invalid banner id");
//     }

//     deletePreviousImage(found.image);
//     const removed = await HomePopImage.findByIdAndDelete(bannerId);

//     successHandler(req, res, {
//         Remarks: "Home pop image deleted successfully",
//         Data: removed,
//     });
// });

module.exports = {
    getHomePopImage,
    getHomePopImagesAdmin,
    // createHomePopImage,
    updateHomePopImage,
    // deleteHomePopImage,
};
