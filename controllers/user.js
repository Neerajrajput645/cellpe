const CRYPTO_SECRET = process.env.CRYPTO_SECRET;
const Otp = require("../models/otpSchema");
const User = require("../models/userSchema");
const Service = require("../models/serviceSchema");

const CryptoJS = require("crypto-js");
const sendSMS = require("../common/sendSMS");
const generateOTP = require("../common/generateOtp");
const asyncHandler = require("express-async-handler");
const successHandler = require("../common/successHandler");
const { profilePicResize } = require("../common/imageResize");
const deletePreviousImage = require("../common/deletePreviousImage");

// user profile
// user profile
const userProfile = asyncHandler(async (req, res) => {
  console.log("fetch user profile");
  const { _id } = req.data;

  const userFound = await User.findById(_id).populate("wallet");

  const { password, ...others } = userFound.toObject();

  // Format wallet amount: 54.2224 -> 54.2
if (others.wallet && others.wallet.balance !== undefined) {
  others.wallet.balance = Number(others.wallet.balance.toFixed(2));
}

  console.log(req.body, "user profile fetch");
  console.log(others, "user profile data");
  successHandler(req, res, {
    Data: others,
    Remarks: "User Profile Fetch Successfull.",
  });
});


// user list
// const userList = asyncHandler(async (req, res) => {
//   const page = parseInt(req.body.pageNumber) || 1; // Default page number is 1
//   const pageSize = parseInt(req.body.pageSize) || 20; // Default page size is 20
//   const searchVal = req.body.search || "";
//   const selectVal = req.body.select || "";
//   const filter = req.body.filter || "";
//   // const startDate = new Date(req.body.startDate) || "";
//   // const endDate = new Date(req.body.endDate) || "";
//   // const activeTab = req.body.activeTab || "";

//   let allUser;
//   let LastPage;

//   if (searchVal || selectVal) {
//     if (selectVal === "phone" || selectVal === "email" || selectVal === "_id") {
//       const FindUser = await User.find({ [selectVal]: searchVal }).populate(
//         "wallet"
//       );
//       if (FindUser) {
//         allUser = FindUser;
//       } else {
//         res.status(400);
//         throw new Error(`${selectVal} - ${searchVal} is Incorrect`);
//       }
//     }
//   } else if (filter) {
//     if (filter === "select") {
//       allUser = await User.find()
//         .sort({ createdAt: -1 })
//         .skip((page - 1) * pageSize)
//         .limit(pageSize)
//         .populate("wallet");

//       LastPage = Math.ceil((await User.countDocuments()) / pageSize);
//     } else if (filter === "htl") {
//       const PopulateUserWallet = await User.find().populate("wallet");

//       const WalletUser = PopulateUserWallet.filter(
//         (user) => user.wallet !== undefined && user.status
//       );
//       const sortData = WalletUser.sort(
//         (a, b) => b.wallet.balance - a.wallet.balance
//       );
//       // console.log(WalletUser, "WalletUser");
//       allUser = sortData.slice(
//         page === 1 ? 0 : pageSize * (page - 1),
//         pageSize * (page - 1) + pageSize
//       );

//       LastPage = Math.ceil((await User.countDocuments()) / pageSize);
//     } else if (filter === "prime") {
//       allUser = await User.find({ isPrime: true })
//         .skip((page - 1) * pageSize)
//         .limit(pageSize)
//         .populate("wallet");

//       LastPage = Math.ceil((await User.countDocuments()) / pageSize);
//     } else if (filter === "oldest") {
//       allUser = await User.find()
//         .skip((page - 1) * pageSize)
//         .limit(pageSize)
//         .populate("wallet");

//       LastPage = Math.ceil((await User.countDocuments()) / pageSize);
//     } else if (filter === "newest") {
//       allUser = await User.find()
//         .sort({ createdAt: -1 })
//         .skip((page - 1) * pageSize)
//         .limit(pageSize)
//         .populate("wallet");

//       LastPage = Math.ceil((await User.countDocuments()) / pageSize);
//     } else if (filter === "active") {
//       allUser = await User.find({ status: true })
//         .skip((page - 1) * pageSize)
//         .limit(pageSize)
//         .populate("wallet");

//       LastPage = Math.ceil((await User.countDocuments()) / pageSize);
//     } else if (filter === "deactive") {
//       allUser = await User.find({ status: false })
//         .skip((page - 1) * pageSize)
//         .limit(pageSize)
//         .populate("wallet");

//       LastPage = Math.ceil((await User.countDocuments()) / pageSize);
//     }
//   } else {
//     allUser = await User.find()
//       .sort({ createdAt: -1 }) // Sort by wallet balance in ascending order
//       .skip((page - 1) * pageSize)
//       .limit(pageSize)
//       .populate("wallet");
//     LastPage = Math.ceil((await User.countDocuments()) / pageSize);
//   }

//   // Success Respond
//   successHandler(req, res, {
//     Data: {
//       data: allUser,
//       lastPage: LastPage,
//     },
//     Remarks: "User Profile Fetch Successfull.",
//   });
// });


const userList = asyncHandler(async (req, res) => {
  const page = parseInt(req.body.pageNumber) || 1;
  const pageSize = parseInt(req.body.pageSize) || 20;
  const searchVal = req.body.search || "";
  const selectVal = req.body.select || "";
  const filter = req.body.filter || "";

  const query = {};
  let sortOption = { createdAt: -1 }; // Default sorting

  // Build query based on search and select
  if (searchVal && selectVal) {
    if (["phone", "email", "_id"].includes(selectVal)) {
      query[selectVal] = searchVal;
    } else if (selectVal === "name") {
      query.$or = [
        { firstName: { $regex: searchVal, $options: "i" } },
        { lastName: { $regex: searchVal, $options: "i" } },
      ];
    }
  }

  // Additional filter
  if (filter) {
    switch (filter) {
      case "prime":
        query.isPrime = true;
        break;
      case "active":
        query.status = true;
        break;
      case "deactive":
        query.status = false;
        break;
      case "oldest":
        sortOption = { createdAt: 1 };
        break;
      case "htl":
        sortOption = { "wallet.balance": -1 };
        break;
      case "newest":
        sortOption = { createdAt: -1 };
        break;
      default:
        break;
    }
  }

  // Execute query with pagination
  let allUsers = await User.find(query)
    .sort(sortOption)
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .populate("wallet", "balance");

  // ⭐ DECRYPT MPIN FOR EACH USER
  allUsers = allUsers.map((user) => {
    try {
      if (user.mPin) {
        const bytes = CryptoJS.AES.decrypt(user.mPin, CRYPTO_SECRET);
        user = user.toObject();
        user.mPin = bytes.toString(CryptoJS.enc.Utf8); // decrypted MPIN
      }
    } catch (e) {
      user = user.toObject();
      user.mPin = null; // if decryption fails
    }
    return user;
  });

  // Pagination count
  const totalCount = await User.countDocuments(query);
  const lastPage = Math.ceil(totalCount / pageSize);

  // Success Response
  successHandler(req, res, {
    Data: {
      data: allUsers,
      lastPage,
    },
    Remarks: "User Profile Fetch Successful.",
  });
});


// update profile
const updateProfile = asyncHandler(async (req, res) => {
  const { _id, avatar } = req.data;
  const findService = await Service.findOne({ name: "PROFILE_UPLOAD" });

  if (findService.status) {
    const FindUser = await User.findOne({ _id });
    if (FindUser.editProfile) {
      // profile
      profilePicResize(req?.file?.path);

      // delete previous image and add new
      if (avatar && req?.file?.path) {
        deletePreviousImage(avatar);
      }

      await User.findByIdAndUpdate(_id, {
        $set: { avatar: req?.file?.path, ...req.body },
      });

      // success respond
      successHandler(req, res, { Remarks: "Profile updated success." });
    } else {
      res.status(400);
      throw new Error("This service currently block");
    }
  } else {
    res.status(400);
    throw new Error("This service currently block");
  }
});

// user refer list

const referList = asyncHandler(async (req, res) => {
  const { referalId } = req.data;
  const data = await User.find({ referBy: referalId }).select("firstName lastName phone email");

  // success respond
  successHandler(req, res, {
    Remarks: "Refer list",
    Data:data,
  });
});

// user upline list
// const uplineList = asyncHandler(async (req, res) => {
//   const { referalId } = req.data;

//   // find parent ids
//   const find_parent_id = async (id) => {
//     const a = await Matrix.findOne({ userId: id });
//     return a?.parentId;
//   };
//   let arr = [];

//   // find upline
//   const find_upline = async (pr) => {
//     const id = await find_parent_id(pr);
//     if (id) {
//       const item = await User.findOne({ referalId: id });
//       arr.push(item);
//       await find_upline(id);
//     }
//   };
//   await find_upline(referalId);

//   // success respond
//   successHandler(req, res, {
//     Remarks: "User upline list",
//     Data: encryptFunc(arr.reverse()),
//   });
// });

// user downlin list
// const downlineList = asyncHandler(async (req, res) => {
//   const data = req.data;
//   const { referalId } = data;

//   const find_parent_id = async (id) => {
//     const a = await Matrix.find({ parentId: id }).select("userId");
//     return a;
//   };
//   let arr = [];

//   const find_downline = async (pr) => {
//     const id = await find_parent_id(pr);
//     if (id) {
//       const ol = id.map(async (val) => {
//         const item = await User.findOne({ referalId: val.userId });
//         return item;
//       });
//       const results = await Promise.all(ol);
//       arr = results;
//     }
//   };
//   await find_downline(referalId);

//   const newArr = arr.reverse().map(async (item) => {
//     const findChilds = await User.find({ referBy: item.referalId });
//     return { ...item._doc, children: findChilds };
//   });

//   const results = await Promise.all(newArr);

//   // success respond
//   successHandler(req, res, {
//     Remarks: "User downline list",
//     Data: encryptFunc({ ...data, children: results.reverse() }),
//   });
// });

// user status update  --- by admin


const statusUpdate = asyncHandler(async (req, res) => {
  const { userId, status } = req.body;

  // update user
  await User.updateOne({ _id: userId }, { $set: { status } });

  // success respond
  successHandler(req, res, { Remarks: "status update success" });
});

// user serviceStatusUpdate  --- by admin
const serviceStatusUpdate = asyncHandler(async (req, res) => {
  const { userId, service, serviceStatus } = req.body;

  // update user
  await User.updateOne({ _id: userId }, { $set: { [service]: serviceStatus } });

  // success respond
  successHandler(req, res, { Remarks: "status update success" });
});

// ------------------------------------ MPIN UPDATE ------------------------------------ //

// creat mpin
const createMpin = asyncHandler(async (req, res) => {
  const { mPin } = req.body;
  const { _id } = req.data;

  // throw error
  if (mPin.toString().length !== 4) {
    res.status(400);
    throw new Error("mPin must be have 4 digits");
  }

  // secure mpin
  const encryptMpin = CryptoJS.AES.encrypt(mPin, CRYPTO_SECRET).toString();
  await User.findByIdAndUpdate(_id, { $set: { mPin: encryptMpin } });

  // success handler
  successHandler(req, res, { Remarks: "MPIN generated successfully." });
});

// verify mpin
const verifyMpin = asyncHandler(async (req, res) => {
  const { mPin } = req.body;
  console.log("mpin", req.body);
  console.log("header", req.headers);
  const userFound = req.data;
  // decrypt mpin
  console.log("user found", userFound.firstName);
  const decryptMpin = CryptoJS.AES.decrypt(
    userFound.mPin,
    CRYPTO_SECRET
  ).toString(CryptoJS.enc.Utf8);

  if (mPin.toString() !== decryptMpin) {
    console.log("invalid m pin")
    res.status(400);
    throw new Error("Please enter valid mPin");
  }
  console.log("m pin success");
  // success respond
  successHandler(req, res, { Remarks: "Verify mPin" });
});

// forgot mpin
const forgotMpin = asyncHandler(async (req, res) => {
  const userFound = req.data;
  const generatedOtp = generateOTP();

  await Otp.create({ phone: userFound.phone, otp: generatedOtp });

  // send otp to mobile
  sendSMS(userFound.phone, generatedOtp);

  //  success handle
  successHandler(req, res, { Remarks: "Otp sent on your email or phone." });
});


// verify otp
const verifyOTP = asyncHandler(async (req, res) => {
  const { otp, newMpin } = req.body;
  const { phone, _id } = req.data;
  const foundOTP = await Otp.findOne({ phone, otp });

  // if invalid otp not found
  if (!foundOTP) {
    res.status(400);
    throw new Error("Invalid OTP");
  }

  // throw error
  if (newMpin.toString().length !== 4) {
    res.status(400);
    throw new Error("mPin must be have 4 digits");
  }

  // secure mpin
  const encryptMpin = CryptoJS.AES.encrypt(
    newMpin.toString(),
    CRYPTO_SECRET
  ).toString();

  // update mpin
  await User.findByIdAndUpdate(_id, { $set: { mPin: encryptMpin } });
  await Otp.deleteOne({ _id: foundOTP._id });

  // success handler
  successHandler(req, res, { Remarks: "Updated mPin" });
});

// update mpin
const updateMpin = asyncHandler(async (req, res) => {
  const { oldMpin, newMpin } = req.body;
  const { _id, mPin } = req.data;

  // decrypt mpin
  const decryptMpin = CryptoJS.AES.decrypt(mPin, CRYPTO_SECRET).toString(
    CryptoJS.enc.Utf8
  );

  if (newMpin.toString().length === 4 && oldMpin.toString() === decryptMpin) {
    // secure mpin
    const encryptMpin = CryptoJS.AES.encrypt(
      newMpin.toString(),
      CRYPTO_SECRET
    ).toString();

    await User.findByIdAndUpdate(_id, {
      $set: { mPin: encryptMpin },
    });

    // success response
    successHandler(req, res, { Remarks: "Updated mPin" });
  } else {
    res.status(400);
    throw new Error(
      parseInt(oldMpin) === mPin
        ? "mPin must be have 4 digits"
        : "wrong old mPin"
    );
  }
});

// ------------------------------------ GIFT CARD ------------------------------------ //

// const giftCardBuy = asyncHandler(async (req, res, response) => {
//   const { _id } = req.data;
//   const txnAmount = response.amount;
//   const currentTime = new Date();
//   const oneMinuteAgo = new Date(currentTime - 60000); // 1 minute ago
//   const findService = await Service.findOne({ name: "GIFT" });
//   if (findService.status) {
//     const lastTransaction = await Txn.findOne({
//       userId: _id,
//       createdAt: { $gte: oneMinuteAgo, $lte: currentTime },
//     }).sort({
//       createdAt: -1,
//     });

//     if (!lastTransaction) {
//       const giftCardTxn = new Txn({
//         userId: _id,
//         recipientId: _id,
//         txnName: "Gift Card",
//         txnDesc: `You have purchased gift card.`,
//         txnType: "debit",
//         txnStatus: "TXN_SUCCESS",
//         txnResource: "Online",
//         orderId: Math.floor(Math.random() * Date.now()) + "giftcard",
//         txnId: Math.floor(Math.random() * Date.now()) + "giftcard",
//         txnAmount,
//         ipAddress: getIpAddress(req),
//       });
//       await giftCardTxn.save();

//       const percentage = 50; // gopoints credit to wallet
//       const primePercentage = 1; // primepoints credit to wallet
//       const result = (percentage / 100) * txnAmount;
//       const result2 = (primePercentage / 100) * txnAmount;

//       const giftCardGoPointTxn = new Txn({
//         userId: _id,
//         recipientId: _id,
//         txnName: "Gift Card",
//         txnDesc: `You have got goPoints on purchased gift card.`,
//         txnType: "credit",
//         txnStatus: "TXN_SUCCESS",
//         txnResource: "GoPoints",
//         orderId: Math.floor(Math.random() * Date.now()) + "goPoints",
//         txnId: Math.floor(Math.random() * Date.now()) + "goPoints",
//         txnAmount: result,
//         ipAddress: getIpAddress(req),
//       });
//       const giftCardPrimePointTxn = new Txn({
//         userId: _id,
//         recipientId: _id,
//         txnName: "Gift Card",
//         txnDesc: `You have got primePoints on purchased gift card.`,
//         txnType: "credit",
//         txnStatus: "TXN_SUCCESS",
//         txnResource: "PrimePoints",
//         orderId: Math.floor(Math.random() * Date.now()) + "primePoints",
//         txnId: Math.floor(Math.random() * Date.now()) + "primePoints",
//         txnAmount: result2,
//         ipAddress: getIpAddress(req),
//       });
//       await giftCardGoPointTxn.save();
//       await giftCardPrimePointTxn.save();

//       const generateCode = uniqueIdGenerator();
//       const findGiftCard = await GiftCard.findOne({ code: generateCode });
//       const currentDate = new Date();
//       // Calculate the date 1 year from now
//       const oneYearFromNow = new Date(currentDate);
//       oneYearFromNow.setFullYear(currentDate.getFullYear() + 1);
//       const newGiftCard = new GiftCard({
//         code: findGiftCard ? uniqueIdGenerator() : generateCode,
//         userId: _id,
//         amount: Number(txnAmount),
//         expiryDate: oneYearFromNow.getTime(),
//       });
//       const createdCard = await newGiftCard.save();

//       // credit goPoints in user wallet
//       await Wallet.updateOne(
//         { userId: _id },
//         { $inc: { goPoints: Number(result), primePoints: Number(result2) } }
//       );

//       // success respond
//       successHandler(req, res, {
//         Remarks: "gift card successfull purchased.",
//         Data: { ...response, cardData: createdCard },
//       });
//     } else {
//       res.status(400);
//       throw new Error("next transaction will possible after 1 minute");
//     }
//   } else {
//     res.status(400);
//     throw new Error("This service currently block");
//   }
// });

// // redeem gift card
// const claimGiftCard = asyncHandler(async (req, res) => {
//   const { _id } = req.data;
//   const { code } = req.body;
//   const findGiftCard = await GiftCard.findOne({ code, redeem: false });
//   const findService = await Service.findOne({ name: "GIFT" });
//   if (findService.status) {
//     if (findGiftCard) {
//       if (findGiftCard.expiryDate > new Date().getTime()) {
//         const giftCardTxn = new Txn({
//           userId: _id,
//           recipientId: _id,
//           txnName: "Gift Card",
//           txnDesc: `You redeemed gift card.`,
//           txnType: "credit",
//           txnStatus: "TXN_SUCCESS",
//           txnResource: "Wallet",
//           orderId: Math.floor(Math.random() * Date.now()) + "redeem",
//           txnId: Math.floor(Math.random() * Date.now()) + "redeem",
//           txnAmount: findGiftCard.amount,
//           ipAddress: getIpAddress(req),
//         });
//         await giftCardTxn.save();
//         await Wallet.updateOne(
//           { userId: _id },
//           { $inc: { balance: findGiftCard.amount } }
//         );
//         await GiftCard.findByIdAndUpdate(findGiftCard._id, {
//           $set: { redeem: true },
//         });
//         successHandler(req, res, { Remarks: "Successfully redeemed card." });
//       } else {
//         res.status(400);
//         throw new Error("gift card has been expired.");
//       }
//     } else {
//       res.status(400);
//       throw new Error("enter valid code");
//     }
//   } else {
//     res.status(400);
//     throw new Error("This service currently block");
//   }
// });

// // get grift card lists by Admin
// const giftCardLists = asyncHandler(
//   asyncHandler(async (req, res) => {
//     const result = await GiftCard.find().populate("userId");
//     successHandler(req, res, {
//       Remarks: "fetch all gift cards",
//       Data: encryptFunc(result),
//     });
//   })
// );

// // get grift card lists by user
// const giftCardListsByUser = asyncHandler(
//   asyncHandler(async (req, res) => {
//     const { _id } = req.data;
//     const result = await GiftCard.find({ userId: _id });
//     successHandler(req, res, {
//       Remarks: "fetch all gift cards",
//       Data: encryptFunc(result.reverse()),
//     });
//   })
// );

module.exports = {
  referList,
  userProfile,
  statusUpdate,
  updateProfile,
  createMpin,
  verifyMpin,
  forgotMpin,
  verifyOTP,
  updateMpin,
  userList,
  serviceStatusUpdate,
};
