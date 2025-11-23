// controllers/commissionController.js
const asyncHandler = require("express-async-handler");
const Commission = require("../../models/newModels/commission");
const successHandler = require("../../common/successHandler");
const deletePreviousImage = require("../../common/deletePreviousImage");
const { profilePicResize } = require("../../common/imageResize");
// controllers/commissionController.js
// const Commission = require("../models/commissionSchema");
// const asyncHandler = require("express-async-handler");
// const successHandler = require("../common/successHandler");
// const deletePreviousImage = require("../common/deletePreviousImage");

/*  
|--------------------------------------------------------------------------
| ADMIN: CREATE COMMISSION
|--------------------------------------------------------------------------
*/
// 📌 Add Commission
const addCommission = asyncHandler(async (req, res) => {
  const commission = await Commission.create({
    ...req.body,
    icon: req?.file?.path,
  });

  successHandler(req, res, {
    Remarks: "Commission added successfully",
    Data: commission,
  });
});

// 📌 Update Commission
const updateCommission = asyncHandler(async (req, res) => {
  const { commissionId } = req.params;
  const found = await Commission.findById(commissionId);

  if (!found) {
    return res.status(400).json({
      Error: true,
      Status: false,
      ResponseStatus: 0,
      StatusCode: "Ex400",
      Remarks: "Invalid commission ID",
    });
  }

  const updated = await Commission.findByIdAndUpdate(
    commissionId,
    {
      ...req.body,
      icon: req.file ? req.file.path : found.icon,
    },
    { new: true }
  );

  successHandler(req, res, {
    Remarks: "Commission updated successfully",
    Data: updated,
  });
});

// 📌 Delete Commission
const deleteCommission = asyncHandler(async (req, res) => {
  const { commissionId } = req.params;

  const found = await Commission.findById(commissionId);
  if (!found) {
    return res.status(400).json({
      Error: true,
      Status: false,
      ResponseStatus: 0,
      StatusCode: "Ex400",
      Remarks: "Invalid commission ID",
    });
  }

  await Commission.findByIdAndDelete(commissionId);

  successHandler(req, res, {
    Remarks: "Commission removed successfully",
    Data: found,
  });
});

// 📌 Get All (Grouped)
const commissionList = asyncHandler(async (req, res) => {
  const all = await Commission.find({status: true}).lean().populate("serviceId");

  // Grouping like your UI response
  const grouped = {
    mobile: {},
    dth: {},
    bbps: {},
  };

  all.forEach((c) => {
    grouped[c.operatorType][c.name] = {
      commission: c.commission,
      icon: c.icon,
    };
  });

  successHandler(req, res, {
    Remarks: "Commission fetched successfully",
    data: grouped,
  });
});

// 📌 Get admin commission
const adminCommission = asyncHandler(async (req, res) => {
  const all = await Commission.find().lean();

  // Grouping like your UI response
  const grouped = {
    mobile: {},
    dth: {},
    bbps: {},
  };

  all.forEach((c) => {
    grouped[c.operatorType][c.name] = {
      commission: c.commission,
      icon: c.icon,
      status: c.status,
    };
  });

  successHandler(req, res, {
    Remarks: "Commission fetched successfully",
    Data: grouped,
  });
});

module.exports = {
  addCommission,
  updateCommission,
  deleteCommission,
  commissionList,
  adminCommission,
};