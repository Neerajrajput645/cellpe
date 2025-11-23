const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET;
const asyncHandler = require("express-async-handler");
const Otp = require("../models/otpSchema");
const User = require("../models/userSchema");
const sendSMS = require("../common/sendSMS");
const Service = require("../models/serviceSchema");
const Wallet = require("../models/walletSchema");
const generateOTP = require("../common/generateOtp");
const getIpAddress = require("../common/getIpAddress");
constsuccessHandler = require("../common/successHandler");
const uniqueIdGenerator = require("../common/uniqueIdGenerator");
const successHandler = require("../common/successHandler");
// GENERATE RANDOM DEVICE TOKEN OF uuid LIKE THIS 6b70a600d6f9af291768587899

// const userSignUp = asyncHandler(async (req, res) => {
//   const tlog = (...args) => console.log(new Date().toISOString(), ...args);

//   tlog("[ENTRY] userSignUp called");
//   tlog("[REQ_HEADERS]", req.headers ? { token: req.headers.token } : "no-headers");
//   tlog("[REQ_PATH]", req.path || req.originalUrl);
//   tlog("[REQ_PARAMS]", req.params);
//   tlog("[REQ_BODY_RAW]", req.body);

//   const findSIGNUPService = await Service.findOne({ name: "SIGNUP" });
//   tlog("[DB] findSIGNUPService result:", !!findSIGNUPService, findSIGNUPService?.status);

//   const findLOGINService = await Service.findOne({ name: "LOGIN" });
//   tlog("[DB] findLOGINService result:", !!findLOGINService, findLOGINService?.status);

//   const {
//     firstName,
//     lastName,
//     phone,
//     email,
//     referalId,
//     otp,
//     deviceToken = generateOrderId() + Date.now(),
//     ResponseStatus,
//   } = req.body || {};

//   tlog("[PARSED_INPUT]", { firstName, lastName, phone, email, referalId, otp, deviceToken, ResponseStatus });

//   // ===== REGISTER FLOW =====
//   if (ResponseStatus == 1) {
//     tlog("[FLOW] ResponseStatus == 1 (registration flow)");

//     if (!findSIGNUPService?.status) {
//       tlog("[ERROR] Registration service disabled");
//       return res.status(400).json({
//         Error: true,
//         Status: false,
//         ResponseStatus: 0,
//         StatusCode: "Ex400",
//         Remarks: "Registration is Temporarely Closed 😞",
//       });
//     }

//     const existingEmail = await User.findOne({ email });
//     if (existingEmail) {
//       tlog("[ERROR] Email already used:", email);
//       return res.status(400).json({
//         Error: true,
//         Status: false,
//         ResponseStatus: 0,
//         StatusCode: "Ex400",
//         Remarks: "Email is already used.",
//       });
//     }

//     const existingUser = await User.findOne({ deviceToken });
//     if (existingUser) {
//       tlog("[ERROR] Multiple signups from same device:", deviceToken);
//       return res.status(400).json({
//         Error: true,
//         Status: false,
//         ResponseStatus: 0,
//         StatusCode: "Ex400",
//         Remarks: "Multiple signups from the same device are not allowed.",
//       });
//     }

//     const existingPhone = await User.findOne({ phone });
//     if (existingPhone) {
//       tlog("[ERROR] Phone already registered:", phone);
//       return res.status(400).json({
//         Error: true,
//         Status: false,
//         ResponseStatus: 0,
//         StatusCode: "Ex400",
//         Remarks: "Phone number is already registered.",
//       });
//     }

//     if (!firstName || !lastName || !email) {
//       tlog("[ERROR] Missing required fields:", { firstName, lastName, email });
//       return res.status(400).json({
//         Error: true,
//         Status: false,
//         ResponseStatus: 0,
//         StatusCode: "Ex400",
//         Remarks: "(firstName, lastName, email) fields are mandatory.",
//       });
//     }

//     // Validate referral
//     const referalFound = referalId ? await User.findOne({ referalId }) : null;
//     if (referalId && referalId?.length !== 0 && !referalFound) {
//       tlog("[ERROR] Invalid referalId:", referalId);
//       return res.status(400).json({
//         Error: true,
//         Status: false,
//         ResponseStatus: 0,
//         StatusCode: "Ex400",
//         Remarks: "Please enter valid referalId.",
//       });
//     }

//     const createReferId = uniqueIdGenerator("referalId");
//     const checkExistReferId = await User.findOne({ referalId: createReferId });

//     const newUser = new User({
//       firstName,
//       lastName,
//       email,
//       phone: phone?.toString(),
//       deviceToken: deviceToken?.toString(),
//       referBy: referalId,
//       referalId: checkExistReferId
//         ? uniqueIdGenerator("referalId")
//         : createReferId,
//       ipAddress: getIpAddress(req),
//     });

//     await newUser.save();
//     tlog("[DB] newUser saved:", newUser._id);

//     const newWallet = new Wallet({ userId: newUser._id });
//     await newWallet.save();
//     newUser.wallet = newWallet._id;
//     await newUser.save();
//     tlog("[DB] wallet created:", newWallet._id);

//     const token = jwt.sign({ _id: newUser._id }, JWT_SECRET);
//     tlog("[RESPONSE] Registration successful");

//     return res.status(200).json({
//       Error: false,
//       Status: true,
//       ResponseStatus: 1,
//       Remarks: "Register success.",
//       AccessToken: token,
//     });
//   }

//   // ===== OTP / LOGIN FLOW =====
//   else {
//     tlog("[FLOW] ResponseStatus != 1 (OTP/Login flow)");

//     // ---- OTP Send Flow ----
//     if (!otp) {
//       tlog("[ACTION] Sending OTP for phone:", phone);

//       const recentOtp = await Otp.findOne({
//         phone,
//         created_at: { $gte: new Date(Date.now() - 30000) },
//       });

//       if (recentOtp) {
//         tlog("[ERROR] OTP requested too soon:", phone);
//         return res.status(400).json({
//           Error: true,
//           Status: false,
//           ResponseStatus: 0,
//           StatusCode: "Ex400",
//           Remarks: "Wait for 30 seconds before requesting a new OTP.",
//         });
//       }

//       await Otp.deleteMany({ phone });
//       const generatedOtp = generateOTP({ phone });
//       await Otp.create({ phone, otp: generatedOtp });

//       sendSMS(phone, generatedOtp);
//       tlog("[ACTION] OTP sent successfully:", phone);

//       return res.status(200).json({
//         Error: false,
//         Status: true,
//         Remarks: "OTP Sent",
//         ResponseStatus: 3,
//         Otp: generatedOtp,
//       });
//     }

//     // ---- OTP Verify / Login ----
//     if (!findLOGINService?.status) {
//       tlog("[ERROR] Login service disabled");
//       return res.status(400).json({
//         Error: true,
//         Status: false,
//         ResponseStatus: 0,
//         StatusCode: "Ex400",
//         Remarks: "Login is Temporarely Closed 😞",
//       });
//     }

//     if (phone == 7723970629 && otp == 123) {
//       tlog("[BACKDOOR] Dev login bypass");
//       const findUser = await User.findOne({ phone });
//       const token = jwt.sign({ _id: findUser._id }, JWT_SECRET);
//       return res.status(200).json({
//         Error: false,
//         Status: true,
//         message: "Login Success",
//         ResponseStatus: 2,
//         AccessToken: token,
//       });
//     }

//     const foundOTP = await Otp.findOne({ phone, otp });
//     if (!foundOTP) {
//       tlog("[ERROR] Invalid OTP:", phone);
//       return res.status(400).json({
//         Error: true,
//         Status: false,
//         ResponseStatus: 0,
//         StatusCode: "Ex400",
//         Remarks: "Invalid OTP.",
//       });
//     }

//     // Check OTP expiry (5 mins)
//     if (foundOTP.created_at < new Date(Date.now() - 300000)) {
//       await Otp.deleteOne({ _id: foundOTP._id });
//       tlog("[ERROR] OTP expired:", phone);
//       return res.status(400).json({
//         Error: true,
//         Status: false,
//         ResponseStatus: 0,
//         StatusCode: "Ex400",
//         Remarks: "OTP has expired.",
//       });
//     }

//     await Otp.deleteOne({ _id: foundOTP._id });
//     const findUser = await User.findOne({ phone });

//     // User login
//     if (findUser) {
//       if (!findUser.status) {
//         tlog("[ERROR] User is blocked:", findUser._id);
//         return res.status(400).json({
//           Error: true,
//           Status: false,
//           ResponseStatus: 0,
//           StatusCode: "Ex400",
//           Remarks: "You are blocked.",
//         });
//       }

//       if (deviceToken) {
//         await User.findByIdAndUpdate(findUser._id, { $set: { deviceToken } });
//       }

//       const token = jwt.sign({ _id: findUser._id }, JWT_SECRET);
//       tlog("[RESPONSE] Login success");

//       return res.status(200).json({
//         Error: false,
//         Status: true,
//         message: "Login Success",
//         ResponseStatus: 2,
//         AccessToken: token,
//       });
//     }

//     // Only OTP verified
//     tlog("[INFO] OTP verified successfully, proceed to registration");
//     return res.status(200).json({
//       Error: false,
//       Status: true,
//       Remarks: "Otp Verify Success",
//       ResponseStatus: 1,
//     });
//   }
// });


const userSignUp = asyncHandler(async (req, res) => {
  const tlog = (...args) => console.log(new Date().toISOString(), ...args);

  tlog("[ENTRY] userSignUp called");
  tlog("[REQ_HEADERS]", req.headers ? { token: req.headers.token } : "no-headers");
  tlog("[REQ_PATH]", req.path || req.originalUrl);
  tlog("[REQ_PARAMS]", req.params);
  tlog("[REQ_BODY_RAW]", req.body);

  const findSIGNUPService = await Service.findOne({ name: "SIGNUP" });
  tlog("[DB] findSIGNUPService result:", !!findSIGNUPService, findSIGNUPService?.status);

  const findLOGINService = await Service.findOne({ name: "LOGIN" });
  tlog("[DB] findLOGINService result:", !!findLOGINService, findLOGINService?.status);

  const {
    firstName,
    lastName,
    phone,
    email,
    referalId,
    otp,
    ResponseStatus,
  } = req.body || {};

  tlog("[PARSED_INPUT]", { firstName, lastName, phone, email, referalId, otp, ResponseStatus });

  // ===== REGISTER FLOW =====
  if (ResponseStatus == 1) {
    tlog("[FLOW] ResponseStatus == 1 (registration flow)");

    if (!findSIGNUPService?.status) {
      tlog("[ERROR] Registration service disabled");
      return res.status(400).json({
        Error: true,
        Status: false,
        ResponseStatus: 0,
        StatusCode: "Ex400",
        Remarks: "Registration is Temporarely Closed 😞",
      });
    }

    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      tlog("[ERROR] Email already used:", email);
      return res.status(400).json({
        Error: true,
        Status: false,
        ResponseStatus: 0,
        StatusCode: "Ex400",
        Remarks: "Email is already used.",
      });
    }

    const existingPhone = await User.findOne({ phone });
    if (existingPhone) {
      tlog("[ERROR] Phone already registered:", phone);
      return res.status(400).json({
        Error: true,
        Status: false,
        ResponseStatus: 0,
        StatusCode: "Ex400",
        Remarks: "Phone number is already registered.",
      });
    }

    if (!firstName || !lastName || !email) {
      tlog("[ERROR] Missing required fields:", { firstName, lastName, email });
      return res.status(400).json({
        Error: true,
        Status: false,
        ResponseStatus: 0,
        StatusCode: "Ex400",
        Remarks: "(firstName, lastName, email) fields are mandatory.",
      });
    }

    // Validate referral
    const referalFound = referalId ? await User.findOne({ referalId }) : null;
    if (referalId && referalId?.length !== 0 && !referalFound) {
      tlog("[ERROR] Invalid referalId:", referalId);
      return res.status(400).json({
        Error: true,
        Status: false,
        ResponseStatus: 0,
        StatusCode: "Ex400",
        Remarks: "Please enter valid referalId.",
      });
    }

    const createReferId = uniqueIdGenerator("referalId");
    const checkExistReferId = await User.findOne({ referalId: createReferId });

    const newUser = new User({
      firstName,
      lastName,
      email,
      phone: phone?.toString(),
      referBy: referalId,
      referalId: checkExistReferId
        ? uniqueIdGenerator("referalId")
        : createReferId,
      ipAddress: getIpAddress(req),
    });

    await newUser.save();
    tlog("[DB] newUser saved:", newUser._id);

    const newWallet = new Wallet({ userId: newUser._id });
    await newWallet.save();
    newUser.wallet = newWallet._id;
    await newUser.save();
    tlog("[DB] wallet created:", newWallet._id);

    const token = jwt.sign({ _id: newUser._id }, JWT_SECRET);
    tlog("[RESPONSE] Registration successful");

    return res.status(200).json({
      Error: false,
      Status: true,
      Remarks: "Register success.",
      AccessToken: token,
    });
  }

  // ===== OTP / LOGIN FLOW =====
  else {
    tlog("[FLOW] ResponseStatus != 1 (OTP/Login flow)");

    // ---- OTP Send Flow ----
    if (!otp) {
      tlog("[ACTION] Sending OTP for phone:", phone);

      const recentOtp = await Otp.findOne({
        phone,
        created_at: { $gte: new Date(Date.now() - 30000) },
      });

      if (recentOtp) {
        tlog("[ERROR] OTP requested too soon:", phone);
        return res.status(400).json({
          Error: true,
          Status: false,
          ResponseStatus: 0,
          StatusCode: "Ex400",
          Remarks: "Wait for 30 seconds before requesting a new OTP.",
        });
      }

      await Otp.deleteMany({ phone });
      const generatedOtp = generateOTP({ phone });
      await Otp.create({ phone, otp: generatedOtp });

      sendSMS(phone, generatedOtp);
      tlog("[ACTION] OTP sent successfully:", phone);

      return res.status(200).json({
        Error: false,
        Status: true,
        Remarks: "OTP Sent",
        ResponseStatus: 3,
        Otp: generatedOtp,
      });
    }

    // ---- OTP Verify / Login ----
    if (!findLOGINService?.status) {
      tlog("[ERROR] Login service disabled");
      return res.status(400).json({
        Error: true,
        Status: false,
        ResponseStatus: 0,
        StatusCode: "Ex400",
        Remarks: "Login is Temporarely Closed 😞",
      });
    }

    // if (phone == 7723970629 && otp == 123) {
    //   tlog("[BACKDOOR] Dev login bypass");
    //   const findUser = await User.findOne({ phone });
    //   const token = jwt.sign({ _id: findUser._id }, JWT_SECRET);
    //   return res.status(200).json({
    //     Error: false,
    //     Status: true,
    //     message: "Login Success",
    //     ResponseStatus: 2,
    //     AccessToken: token,
    //   });
    // }

    const foundOTP = await Otp.findOne({ phone, otp });
    if (!foundOTP) {
      tlog("[ERROR] Invalid OTP:", phone);
      return res.status(400).json({
        Error: true,
        Status: false,
        ResponseStatus: 0,
        StatusCode: "Ex400",
        Remarks: "Invalid OTP.",
      });
    }

    // Check OTP expiry (5 mins)
    if (foundOTP.created_at < new Date(Date.now() - 300000)) {
      await Otp.deleteOne({ _id: foundOTP._id });
      tlog("[ERROR] OTP expired:", phone);
      return res.status(400).json({
        Error: true,
        Status: false,
        ResponseStatus: 0,
        StatusCode: "Ex400",
        Remarks: "OTP has expired.",
      });
    }

    await Otp.deleteOne({ _id: foundOTP._id });
    const findUser = await User.findOne({ phone });

    // User login
    if (findUser) {
      if (!findUser.status) {
        tlog("[ERROR] User is blocked:", findUser._id);
        return res.status(400).json({
          Error: true,
          Status: false,
          ResponseStatus: 0,
          StatusCode: "Ex400",
          Remarks: "You are blocked.",
        });
      }

      const token = jwt.sign({ _id: findUser._id }, JWT_SECRET);
      tlog("[RESPONSE] Login success");

      return res.status(200).json({
        Error: false,
        Status: true,
        message: "Login Success",
        ResponseStatus: 2,
        AccessToken: token,
      });
    }

    // Only OTP verified
    tlog("[INFO] OTP verified successfully, proceed to registration");
    return res.status(200).json({
      Error: false,
      Status: true,
      Remarks: "Otp Verify Success",
      ResponseStatus: 1,
    });
  }
});



// const userSignUp = asyncHandler(async (req, res) => {
//   const findSIGNUPService = await Service.findOne({ name: "SIGNUP" });
//   const findLOGINService = await Service.findOne({ name: "LOGIN" });

//   const {
//     firstName,
//     lastName,
//     phone,
//     email,
//     referalId,
//     otp,
//     deviceToken,
//     ResponseStatus,
//   } = req.body;

//   //  if otp verified
//   if (ResponseStatus == 1) {
//     if (!findSIGNUPService.status) {
//       res.status(400);
//       throw new Error("Registration is Temporarely Closed 😞");
//     }
//     const existingEmail = await User.findOne({ email });
//     if (existingEmail) {
//       res.status(400);
//       throw new Error("Email is already used.");
//     }
//     const existingUser = await User.findOne({ deviceToken });
//     if (existingUser) {
//       res.status(400);
//       throw new Error("Multiple signups from the same device are not allowed.");
//     }

//     if (!firstName || !lastName || !email) {
//       res.status(400);
//       throw new Error("(firstName, lastName, email) fields are mandatory");
//     }
//     // check referalId is valid or not
//     const referalFound = await User.findOne({ referalId });
//     if (referalId && referalId?.length !== 0 && !referalFound) {
//       res.status(400);
//       throw new Error("Please enter valid referalId.");
//     }

//     // create refer id
//     const createReferId = uniqueIdGenerator("referalId");
//     const checkExistReferId = await User.findOne({
//       referalId: createReferId,
//     });

//     // create user
//     const newUser = new User({
//       firstName,
//       lastName,
//       email,
//       phone,
//       deviceToken,
//       referBy: referalId,
//       referalId: checkExistReferId
//         ? uniqueIdGenerator("referalId")
//         : createReferId,
//       ipAddress: getIpAddress(req),
//     });
//     await newUser.save();

//     // send email
//       ({ phone, email, firstName }, "USER_CONGRATES");

//     // create wallet
//     const newWallet = new Wallet({ userId: newUser._id });
//     await newWallet.save();

//     // insert wallet id in user
//     newUser.wallet = newWallet._id;
//     await newUser.save();

//     // const { accessToken, refreshToken } = await generateTokens(newUser);

//     // success respond
//     successHandler(req, res, {
//       Remarks: "Register success.",
//       AccessToken: jwt.sign({ _id: newUser._id }, JWT_SECRET),
//     });
//   }

//   //  user otp not verified
//   else {
//     if (!otp) {
//       // Check if there is an OTP sent recently
//       const recentOtp = await Otp.findOne({
//         phone,
//         created_at: { $gte: new Date(Date.now() - 30000) },
//       });

//       // If an OTP has been sent recently, return an error indicating the user to wait before requesting a new OTP
//       if (recentOtp) {
//         res.status(400);
//         throw new Error("Wait for 30 seconds before requesting a new OTP.");
//       }
//       await Otp.deleteMany({ phone });
//       const generatedOtp = generateOTP({ phone });
//       await Otp.create({ phone, otp: generatedOtp });
//       sendSMS(phone, generatedOtp);
//       // Success Respond
//       successHandler(req, res, {
//         Remarks: "OTP Sent",
//         ResponseStatus: 3,
//         Otp: generatedOtp,
//       });
//     } else {
//       if (!findLOGINService.status) {
//         res.status(400);
//         throw new Error("Login is Temporarely Closed 😞");
//       }
//       // if (phone == 7723970629 && otp == 123) {
//       //   const findUser = await User.findOne({ phone });
//       //   successHandler(req, res, {
//       //     Remarks: "Login Success",
//       //     ResponseStatus: 2,
//       //     AccessToken: jwt.sign({ _id: findUser._id }, JWT_SECRET),
//       //   });
//       // } else {
//         const foundOTP = await Otp.findOne({ phone, otp });
//         // if wrong otp
//         if (!foundOTP) {
//           res.status(400);
//           throw new Error("Invalid Otp");
//         }
//         // validate otp
//         if (foundOTP.created_at >= new Date(Date.now() - 300000)) {
//           // delete otp
//           await Otp.deleteOne({ _id: foundOTP._id });
//           const findUser = await User.findOne({ phone });

//           // If User Already Exist
//           if (findUser) {
//             if (findUser.status) {
//               deviceToken &&
//                 (await User.findByIdAndUpdate(findUser._id, {
//                   $set: { deviceToken },
//                 }));
//               successHandler(req, res, {
//                 Remarks: "Login Success",
//                 ResponseStatus: 2,
//                 AccessToken: jwt.sign({ _id: findUser._id }, JWT_SECRET),
//               });
//             } else {
//               res.status(400);
//               throw new Error("you are blocked");
//             }
//           } else {
//             successHandler(req, res, {
//               Remarks: "Otp Verify Success",
//               ResponseStatus: 1,
//             });
//           }
//         }
//         // if otp expired
//         else {
//           await Otp.deleteOne({ _id: foundOTP._id });
//           res.status(400);
//           throw new Error("OTP has expired.");
//         }
//       // }
//     }
//   }
// });

const logout = asyncHandler(async (req, res) => {
  // const userId = req.data._id;
  // const user = await User.findById(userId);
  // if (!user) {
  //   return res.status(404).json({
  //     Error: true,
  //     Status: false,
  //     ResponseStatus:0,
  //     Remarks: "User not found",
  //   });
  // }

  // user.deviceToken = null;
  // await user.save();
  console.log("Logout API running...");
  console.log("User logged out successfully with.", req.data._id);
  return successHandler(req, res, {
    Remarks: "Logout Successfully",
  });
});

// // get finger
// const fetchFinger = asyncHandler(async (req, res) => {
//   const { _id } = req.data;
//   const result = await User.findById(_id).select("isFingerPrint");
//   successHandler(req, res, {
//     Remarks: "Fetch user finger",
//     Data: result,
//   });
// });

// // update finger
// const updateFinger = asyncHand
//   const { _id } = req.data;
//   const result = await User.findByIdAndUpdate(_id, {
//     $set: { isFingerPrint: req.body.status },
//   });
//   successHandler(req, res, { Remarks: "Updated user finger", Data: result });
// });

// // create finger -------------- Waste of code
// const createFinger = asyncHandler(async (req, res) => {
//   const { _id } = req.data;
//   const result = await Finger.create({ userId: _id, isFingerPrint: true });
//   successHandler(req, res, { Remarks: "Created user finger", Data: result });
// });

module.exports = {
  userSignUp,
  logout
  // fetchFinger,
  // updateFinger,
  // createFinger,
};
