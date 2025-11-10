const asyncHandler = require("express-async-handler");
const Affiliate = require("../models/affiliateSchema");
const successHandler = require("../common/successHandler");
const deletePreviousImage = require("../common/deletePreviousImage");
const { encryptFunc } = require("../common/encryptDecrypt");

// get affiliate list
const list = asyncHandler(async (req, res) => {
  const result = await Affiliate.find();
  successHandler(req, res, {
    Remarks: "Affiliate list success.",
    Data: (result),
  });
});

// create affiliate list
const createAffiliate = asyncHandler(async (req, res) => {
  const newAffiliate = new Affiliate({ ...req.body, image: req?.file?.path });
  const result = await newAffiliate.save();
  successHandler(req, res, { Remarks: "Create affiliate item.", Data: result });
});

// update affiliate list
const updateAffiliate = asyncHandler(async (req, res) => {
  const { affiliateId } = req.params;
  const findAffiliate = await Affiliate.findById(affiliateId);

  if (!findAffiliate) {
    res.status(400);
    throw new Error("Please enter valid id.");
  }
  deletePreviousImage(findAffiliate.image);
  const result = await Affiliate.updateOne(
    { _id: affiliateId },
    {
      $set: {
        ...req.body,
        image: req.file ? req.file.path : findAffiliate.image,
      },
    }
  );
  successHandler(req, res, { Remarks: "Update affiliate item.", Data: result });
});

// remove affiliate list
const removeAffiliate = asyncHandler(async (req, res) => {
  const { affiliateId } = req.params;
  const findAffiliate = await Affiliate.findById(affiliateId);

  if (!findAffiliate) {
    res.status(400);
    throw new Error("Please enter valid id.");
  }

  deletePreviousImage(findAffiliate.image);
  const result = await Affiliate.findByIdAndRemove(affiliateId);
  successHandler(req, res, {
    Remarks: "Removed affiliate stroe.",
    Data: result,
  });
});

module.exports = { list, removeAffiliate, createAffiliate, updateAffiliate };
