const jwt = require("jsonwebtoken");
const CryptoJS = require("crypto-js");
const asyncHandler = require("express-async-handler");

const JWT_SECRET = process.env.JWT_SECRET;
const CRYPTO_SECRET = process.env.CRYPTO_SECRET;

const Otp = require("../models/otpSchema");
const Admin = require("../models/adminSchema");
const Users = require("../models/userSchema");
const Txns = require("../models/txnSchema");

const AdminWallet = require("../models/adminWalletSchema");
const successHandler = require("../common/successHandler");
const generateOTP = require("../common/generateOtp");
const sendSMS = require("../common/sendSMS");
const otpSchema = require("../models/otpSchema");
// const { encryptFunc } = require("../common/encryptDecrypt");
const Recharges = require("../models/service/rechargeSchema");
const bbps = require("../models/service/bbps");
const walletSchema = require("../models/walletSchema");
// admin create
const adminRegister = asyncHandler(async (req, res) => {
  const { phone, email, password } = req.body;

  const adminFindByEmail = await Admin.findOne({ email });
  const adminFindByPhone = await Admin.findOne({ phone });

  if (adminFindByEmail || adminFindByPhone) {
    const key = adminFindByPhone ? "Phone" : "Email";
    res.status(400);
    throw new Error(`${key} already used`);
  }

  const encryptedPassword = CryptoJS.AES.encrypt(
    password,
    CRYPTO_SECRET
  ).toString();

  // create admin
  const newAdmin = new Admin({
    ...req.body,
    password: encryptedPassword,
  });
  await newAdmin.save();

  // create wallet
  const newWallet = new AdminWallet({ adminId: newAdmin._id });
  await newWallet.save();

  // update admin
  newAdmin.wallet = newWallet._id;
  await newAdmin.save();

  // success respond
  successHandler(req, res, { Remarks: "Admin Created Succes." });
});

// admin login
// const adminLogin = asyncHandler(async (req, res) => {
//   const { email, password } = req.body;
//   const adminFindByEmail = await Admin.findOne({ email });

//   if (!adminFindByEmail) {
//     res.status(401);
//     throw new Error("Wrong credentials");
//   }

//   const originalPassword = CryptoJS.AES.decrypt(
//     adminFindByEmail.password,
//     CRYPTO_SECRET
//   ).toString(CryptoJS.enc.Utf8);

//   if (originalPassword === password) {
//     const token = jwt.sign({ email }, JWT_SECRET);
//     successHandler(req,res, {
//       Remarks: "Admin login success.",
//       AccessToken: token,
//     });
//   } else {
//     res.status(401);
//     throw new Error("Worng password");
//   }
// });

// admin login
const adminLogin = asyncHandler(async (req, res) => {
  const { phone, otp } = req.body;
  const findUser = await Admin.findOne({ phone });

  if (findUser) {
    if (!otp) {
      await Otp.deleteMany({ phone });
      const generatedOtp = generateOTP();
      await Otp.create({ phone, otp: generatedOtp });
      if (phone == "8871265906" && otp == "123456") {
        successHandler(req, res, {
          Remarks: "otp will receive sms",
          ResponseStatus: 3,
          Otp: generatedOtp,
        });
      }
      sendSMS(phone, generatedOtp);

      // Success Respond
      successHandler(req, res, {
        Remarks: "otp will receive sms",
        ResponseStatus: 3,
        Otp: generatedOtp,
      });
    } else {
      const foundOTP = await Otp.findOne({ phone, otp });

      // if wrong otp
      if (!foundOTP) {
        res.status(400);
        throw new Error("Invalid Otp");
      }

      // validate otp
      if (foundOTP.created_at >= new Date(Date.now() - 300000)) {
        // delete otp
        await Otp.deleteOne({ _id: foundOTP._id });

        successHandler(req, res, {
          Remarks: "Login Success",
          ResponseStatus: 2,
          AccessToken: jwt.sign({ _id: findUser._id }, JWT_SECRET),
        });
      }
      // if otp expired
      else {
        await Otp.deleteOne({ _id: foundOTP._id });
        res.status(400);
        throw new Error("OTP has expired.");
      }
    }
  } else {
    res.status(400);
    throw new Error("invalid phone number");
  }
});

// admin profile
const adminProfile = asyncHandler(async (req, res) => {
  const { _id } = req.data;
  const adminFound = await Admin.findOne({ _id }).populate("wallet");
  successHandler(req, res, {
    Remarks: "Admin Profile Data",
    Data: (adminFound),
  });
});

// MPIN View
const MpinView = asyncHandler(async (req, res) => {
  const { userId } = req.body;
  const userFound = await Users.findOne({ _id: userId });
  // decrypt mpin
  const decryptMpin = CryptoJS.AES.decrypt(
    userFound.mPin,
    CRYPTO_SECRET
  ).toString(CryptoJS.enc.Utf8);
  successHandler(req, res, {
    Data: {
      mpin: decryptMpin,
      userId: userId,
    },
    Remarks: "MPIN View Successfully",
    ResponseStatus: 1,
  });
});

// Dashboard api
// const dashboardApi = asyncHandler(async (req, res) => {
//   const today = new Date();
//   const startOfDay = new Date(
//     today.getFullYear(),
//     today.getMonth(),
//     today.getDate(),
//     0,
//     0,
//     0
//   );
//   const endOfDay = new Date(
//     today.getFullYear(),
//     today.getMonth(),
//     today.getDate(),
//     23,
//     59,
//     59
//   );
//   const todayRecharges = await Recharges.find({
//     createdAt: { $gte: startOfDay, $lte: endOfDay },
//     status: { $in: ["Success", "success"] },
//   });
//   const todayBillPayment = await bbps.find({
//     createdAt: { $gte: startOfDay, $lte: endOfDay },
//     status: { $in: ["Success", "success"] },
//   });
//   const todayAddmoney = await Txns.find({
//     createdAt: { $gte: startOfDay, $lte: endOfDay },
//     txnResource: "Online",
//   });
//   const todayUser = await Users.find({
//     createdAt: { $gte: startOfDay, $lte: endOfDay },
//   });

//   const allUsers = await Users.find();
// //   const allOrders = await Orders.find();
// //   const allProducts = await Products.find();
// //   const allCategory = await Category.find();
// //   const allMerchants = await Merchants.find();

//   const data = [
//     {
//       name: "Users",
//       count: allUsers.length,
//       Active: allUsers.filter((item) => item.status).length,
//       Prime: allUsers.filter((item) => item.isPrime).length,
//       TodayUser: todayUser.length,
//     },
//     {
//       name: "Today's Recharges",
//       amount: todayRecharges.reduce((acc, curr) => acc + curr.amount, 0),
//       recharge: todayRecharges.length,
//     },
//     {
//       name: "Today's Bill Payment",
//       amount: todayBillPayment.reduce((acc, curr) => acc + curr.amount, 0),
//       recharge: todayBillPayment.length,
//     },
//     {
//       name: "Today's Add Money",
//       amount: todayAddmoney.reduce((acc, curr) => acc + curr.txnAmount, 0),
//       recharge: todayAddmoney.length,
//     },
//     // { name: "Orders", count: allOrders.length },
//     // { name: "Category", count: allCategory.length },
//     // { name: "Products", count: allProducts.length },
//     // { name: "Merchants", count: allMerchants.length },
//   ];
//   successHandler(req, res, {
//     Remarks: "Dashboard Data",
//     Data: encryptFunc(data),
//   });
// });

const dashboardApi = asyncHandler(async (req, res) => {
  const today = new Date();
  const startOfDay = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    0,
    0,
    0
  );
  const endOfDay = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    23,
    59,
    59
  );

  const [
    todayRecharges,
    todayBillPayment,
    todayAddmoney,
    userStats,
    totalWalletAmount,
  ] = await Promise.all([
    Recharges.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfDay, $lte: endOfDay },
          status: { $in: ["Success", "success"] },
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]),
    bbps.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfDay, $lte: endOfDay },
          status: { $in: ["Success", "success"] },
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]),
    Txns.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfDay, $lte: endOfDay },
          txnResource: "Online",
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$txnAmount" },
          count: { $sum: 1 },
        },
      },
    ]),
    Users.aggregate([
      {
        $facet: {
          totalUsers: [{ $count: "count" }],
          activeUsers: [{ $match: { status: true } }, { $count: "count" }],
          primeUsers: [{ $match: { isPrime: true } }, { $count: "count" }],
          todayUsers: [
            { $match: { createdAt: { $gte: startOfDay, $lte: endOfDay } } },
            { $count: "count" },
          ],
        },
      },
    ]),
    walletSchema.aggregate([
      {
        $group: {
          _id: null,
          totalWallet: { $sum: "$balance" }, // Assuming 'balance' is the field storing wallet amounts
        },
      },
    ]),
  ]);

  const userStatData = userStats[0] || {};
  const totalUsers = userStatData.totalUsers?.[0]?.count || 0;
  const activeUsers = userStatData.activeUsers?.[0]?.count || 0;
  const primeUsers = userStatData.primeUsers?.[0]?.count || 0;
  const todayUsers = userStatData.todayUsers?.[0]?.count || 0;
  const totalWallet = totalWalletAmount[0]?.totalWallet || 0;

  const data = [
    {
      name: "Users",
      count: totalUsers,
      Active: activeUsers,
      Prime: primeUsers,
      TodayUser: todayUsers,
    },
    {
      name: "Today's Recharges",
      amount: todayRecharges[0]?.totalAmount.toFixed(2) || 0,
      recharge: todayRecharges[0]?.count || 0,
    },
    {
      name: "Today's Bill Payment",
      amount: todayBillPayment[0]?.totalAmount.toFixed(2) || 0,
      recharge: todayBillPayment[0]?.count || 0,
    },
    {
      name: "Today's Add Money",
      amount: todayAddmoney[0]?.totalAmount.toFixed(2) || 0,
      recharge: todayAddmoney[0]?.count || 0,
    },
    // {
    //   name: "Total Wallet Balance",
    //   amount: totalWallet.toFixed(2),
    // },
  ];

  successHandler(req, res, {
    Remarks: "Dashboard Data",
    Data: (data),
  });
});

// Get OTP List
const otpList = asyncHandler(async (req, res) => {
  const Otps = await otpSchema.find();
  successHandler(req, res, {
    Data: (Otps),
    Remarks: "OTP Get Successfully",
    ResponseStatus: 1,
  });
});

// Add Refer ID to User Direct From Admin
const AddReferToUser = asyncHandler(async (req, res) => {
  const { userId, referalId } = req.body;

  const userFound = await Users.findOne({ _id: userId });
  if (!userFound) {
    res.status(400);
    throw new Error("User Not Found");
  }

  // If User Already Have ReferBy
  if (userFound.referBy) {
    res.status(400);
    throw new Error("User has already been referred by someone ");
  }
  // Else Set the referब and save it in DB
  const User_Refer_ID_Check = await Users.findOne({ referalId: referalId });

  // Check Refer ID Right or Wrong
  if (!User_Refer_ID_Check) {
    res.status(400);
    throw new Error("This refer ID is wrong");
  }

  // Set ReferBy into DB
  await Users.findByIdAndUpdate(
    { _id: userId },
    {
      $set: { referBy: referalId },
    }
  );

  // success respond
  successHandler(req, res, { Remarks: "ReferBy has been successfully added" });
});

module.exports = {
  adminRegister,
  adminLogin,
  adminProfile,
  MpinView,
  dashboardApi,
  otpList,
  AddReferToUser,
};
