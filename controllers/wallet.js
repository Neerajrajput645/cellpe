const Otp = require("../models/otpSchema");
const Txn = require("../models/txnSchema");
const User = require("../models/userSchema");
const Bank = require("../models/bankSchema");
const Admin = require("../models/adminSchema");
const Wallet = require("../models/walletSchema");
const Matrix = require("../models/matrixSchema");
const Service = require("../models/serviceSchema");
const Merchant = require("../models/merchantSchema");
const Commission = require("../models/newModels/commission");
const getIpAddress = require("../common/getIpAddress");
const AdminTxn = require("../models/adminTxnSchema");
const Withdraw = require("../models/withdrawSchema");
const asyncHandler = require("express-async-handler");
const successHandler = require("../common/successHandler");
const AdminWallet = require("../models/adminWalletSchema");
const Notification = require("../models/notificationSchema");
const sendNotification = require("../common/sendNotification");
const generateOTP = require("../common/generateOtp");
const sendSMS = require("../common/sendSMS");
const CryptoJS = require("crypto-js");
const { encryptFunc } = require("../common/encryptDecrypt");
const userSchema = require("../models/userSchema");
// const { handleFirstTransaction } = require("./payment");
const CRYPTO_SECRET = process.env.CRYPTO_SECRET;
const sendEmail = require("../common/sendEmail");
const appSetting = require("../models/appSetting");


const getWalletTxn = asyncHandler(async (req, res) => {
  // Extract pagination + sorting
  let { page = 1, limit = 10, sort = "-createdAt" } = req.query;
  page = Number(page);
  limit = Number(limit);

  // Build dynamic filters
  const condition = { ...req.query };
  delete condition.page;
  delete condition.limit;
  delete condition.sort;

  condition.txnResource = "Wallet";

  // Get wallet info if userId exists
  let wallet = null;
  if (req.query?.userId) {
    wallet = await Wallet.findOne({ userId: req.query.userId });
  }

  // MongoDB query with pagination
  const skip = (page - 1) * limit;

  const txn = await Txn.find(condition).populate("userId")
    .sort(sort)
    .skip(skip)
    .limit(limit);

  // Total count for pagination
  const totalCount = await Txn.countDocuments(condition);

  successHandler(req, res, {
    Remarks: "Fetch wallet txn",
    Data: {
      wallet,
      txn,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    },
  });
});


// check user exist or not before send money
const userCheck = asyncHandler(async (req, res) => {
  const { receiverWallet } = req.body;

  const receiverUserFound =
    receiverWallet.length > 10
      ? await Merchant.findOne({ mid: receiverWallet })
      : await User.findOne({ phone: receiverWallet });

  if (receiverUserFound) {
    // successHandler
    successHandler(req, res, {
      Remarks: "Fetch user",
      Data: receiverUserFound,
    });
  } else {
    res.status(400);
    throw new Error(
      receiverWallet.length > 10 ? "invalid qr code" : "Invalid user"
    );
  }
});

// send money to user  --- push notification
const sendMoney = asyncHandler(async (req, res) => {
  const findService = await Service.findOne({ name: "SEND_MONEY" });
  if (findService.status) {
    const userFound = req.data;

    const FindUser = await User.findOne({ _id: userFound._id });
    if (!FindUser) {
      res.status(400);
      throw new Error("User not found");
    }
    if (FindUser?.sendMoney) {
      const { amount, receiverWallet, mid, otp } = req.body;

      const findAmdinWalletFound = await AdminWallet.findOne();
      const receiverUserFound = mid
        ? await Merchant.findOne({ mid })
        : await User.findOne({ phone: receiverWallet });

      const currentTime = new Date();
      const oneMinuteAgo = new Date(currentTime - 60000); // 1 minute ago
      const lastTransaction = await Txn.findOne({
        userId: userFound._id,
        createdAt: { $gte: oneMinuteAgo, $lte: currentTime },
      }).sort({ createdAt: -1 });

      if (Number(amount) <= 2000 && Number(amount) > 0) {
        if (!lastTransaction) {
          if (receiverUserFound) {
            if (userFound.phone !== receiverWallet) {
              // update wallet of receiver & sender
              const walletFound = await Wallet.findOne({
                userId: userFound._id,
              });
              const receiverWalletFound = await Wallet.findOne({
                userId: mid ? receiverUserFound.userId : receiverUserFound._id,
              });

              if (walletFound.balance >= amount) {
                if (!otp) {
                  await Otp.deleteMany({ phone: userFound.phone });
                  const generatedOtp = generateOTP();
                  await Otp.create({
                    phone: userFound.phone,
                    otp: generatedOtp,
                  });
                  sendSMS(userFound.phone, generatedOtp);

                  // Success Respond
                  successHandler(req, res, {
                    Remarks: "otp will receive sms",
                    ResponseStatus: 3,
                  });
                } else {
                  const foundOTP = await Otp.findOne({
                    phone: userFound.phone,
                    otp,
                  });

                  // if wrong otp
                  if (!foundOTP) {
                    res.status(400);
                    throw new Error("Invalid Otp");
                  }

                  if (foundOTP.created_at >= new Date(Date.now() - 300000)) {
                    // delete otp
                    await Otp.deleteOne({ _id: foundOTP._id });

                    const findMerchant = mid
                      ? receiverUserFound
                      : await Merchant.findOne({
                        userId: receiverUserFound?._id,
                      });

                    // Calculation of commissions
                    const totalCommission =
                      (Number(amount) / 100) * findMerchant?.commission;
                    const userCashback = (Number(amount) / 100) * 5;
                    const afterGiveUser = totalCommission - userCashback;
                    const creatorCommission =
                      (Number(afterGiveUser) / 100) * 20;
                    const userUplineCommission =
                      (Number(afterGiveUser) / 100) * 20;
                    const creatorUplineCommission =
                      (Number(afterGiveUser) / 100) * 20;

                    // total payable to merchant
                    const payToReceiver =
                      mid && Number(findMerchant?.commission) >= 10
                        ? Number(amount) - totalCommission
                        : Number(amount);

                    if (mid && Number(findMerchant?.commission) >= 10) {
                      // company commission add
                      await AdminWallet.updateOne(
                        { _id: findAmdinWalletFound._id },
                        { $inc: { balance: totalCommission } }
                      );
                      const deliveryChargeAddOnAdmin = new AdminTxn({
                        adminId: findAmdinWalletFound.adminId,
                        recipientId: findAmdinWalletFound.adminId,
                        txnAmount: totalCommission,
                        remarks:
                          "you got merchant payment charges on using qrcode",
                        txnType: "credit",
                        txnId: Math.floor(Math.random() * Date.now()) + "dc",
                        txnStatus: "TXN_SUCCESS",
                        txnResource: "Wallet",
                      });
                      await deliveryChargeAddOnAdmin.save();

                      // creator merchant commission
                      const findRefer = await User.findOne({
                        referalId: userFound.referBy,
                      });
                      if (findRefer) {
                        await AdminWallet.updateOne(
                          { _id: findAmdinWalletFound._id },
                          { $inc: { balance: -Number(creatorCommission) } }
                        );
                        await Wallet.updateOne(
                          { userId: findRefer._id },
                          { $inc: { balance: Number(creatorCommission) } }
                        );
                        const referIncome = new Txn({
                          userId: findRefer._id,
                          recipientId: findRefer._id,
                          txnName: "Merchant Creator Commission",
                          txnDesc: `You have get ${creatorCommission} rupay as repurchase income.`,
                          txnAmount: creatorCommission,
                          txnType: "credit",
                          txnStatus: "TXN_SUCCESS",
                          txnResource: "Wallet",
                          txnId:
                            Math.floor(Math.random() * Date.now()) + "refer",
                          orderId:
                            Math.floor(Math.random() * Date.now()) + "refer",
                          ipAddress: getIpAddress(req),
                        });
                        await referIncome.save();
                      }

                      // user cashback
                      if (walletFound.goPoints !== 0) {
                        const cbTXn = new Txn({
                          userId: userFound._id,
                          recipientId: userFound._id,
                          txnName: "Cashback",
                          txnDesc: `you got cashback`,
                          txnAmount:
                            userCashback >= walletFound.goPoints
                              ? walletFound.goPoints
                              : userCashback,
                          txnType: "credit",
                          txnId: Math.floor(Math.random() * Date.now()) + "cb",
                          orderId:
                            Math.floor(Math.random() * Date.now()) + "cb",
                          txnStatus: "TXN_SUCCESS",
                          txnResource: "Wallet",
                          ipAddress: getIpAddress(req),
                        });
                        await cbTXn.save();

                        await Wallet.findByIdAndUpdate(walletFound._id, {
                          $set: {
                            balance:
                              walletFound.balance +
                              (userCashback >= walletFound.goPoints
                                ? Number(walletFound.goPoints)
                                : Number(userCashback)),
                            goPoints:
                              userCashback >= walletFound.goPoints
                                ? 0
                                : walletFound.goPoints - userCashback,
                          },
                        });
                        await AdminWallet.updateOne(
                          { _id: findAmdinWalletFound._id },
                          {
                            $inc: {
                              balance: -(userCashback >= walletFound.goPoints
                                ? walletFound.goPoints
                                : userCashback),
                            },
                          }
                        );
                        const GoPointsTXn = new Txn({
                          userId: userFound._id,
                          recipientId: userFound._id,
                          txnName: "Used mecrhant pay",
                          txnDesc: `used in merchant service`,
                          txnAmount:
                            userCashback >= walletFound.goPoints
                              ? walletFound.goPoints
                              : userCashback,
                          txnType: "debit",
                          txnId:
                            Math.floor(Math.random() * Date.now()) + "gominus",
                          orderId:
                            Math.floor(Math.random() * Date.now()) + "gominus",
                          txnStatus: "TXN_SUCCESS",
                          txnResource: "GoPoints",
                          ipAddress: getIpAddress(req),
                        });
                        await GoPointsTXn.save();
                      }

                      // user upline commission distribute start
                      const find_parent_id = async (id) => {
                        const a = await Matrix.findOne({ userId: id });
                        return a?.parentId;
                      };
                      let arr = [];
                      const find_upline = async (pr) => {
                        const id = await find_parent_id(pr);
                        if (id) {
                          arr.push(id);
                          await find_upline(id);
                        }
                      };

                      await find_upline(userFound.referalId);
                      const perUp = userUplineCommission / arr.length;
                      if (arr.length > 0) {
                        await AdminWallet.updateOne(
                          { _id: findAmdinWalletFound._id },
                          { $inc: { balance: -userUplineCommission } }
                        );
                        arr.map(async (item) => {
                          const fin = await User.findOne({ referalId: item });
                          if (fin.level <= 10) {
                            await Wallet.updateOne(
                              { userId: fin._id },
                              {
                                $inc: {
                                  balance: (
                                    Math.round(perUp * 100) / 100
                                  ).toFixed(2),
                                },
                              }
                            );
                            // create txn History
                            const repurchaseIncom = new Txn({
                              userId: fin._id,
                              recipientId: fin._id,
                              txnName: "Repurchase Income",
                              txnDesc: `You have get ${(
                                Math.round(perUp * 100) / 100
                              ).toFixed(2)} rupay as repurchase income.`,
                              txnAmount: (
                                Math.round(perUp * 100) / 100
                              ).toFixed(2),
                              txnType: "credit",
                              txnStatus: "TXN_SUCCESS",
                              txnResource: "Wallet",
                              txnId:
                                Math.floor(Math.random() * Date.now()) +
                                "repurchase" +
                                fin?.referalId,
                              orderId:
                                Math.floor(Math.random() * Date.now()) +
                                "repurchase" +
                                fin?.referalId,
                              ipAddress: getIpAddress(req),
                            });
                            await repurchaseIncom.save();

                            // notification
                            const notification = {
                              title: "Repurchase Income",
                              body: `You have get ${(
                                Math.round(perUp * 100) / 100
                              ).toFixed(2)} rupay as repurchase income.`,
                            };

                            const newNotification = new Notification({
                              ...notification,
                              recipient: fin._id,
                            });
                            await newNotification.save();

                            // send notification
                            fin?.deviceToken &&
                              sendNotification(notification, fin?.deviceToken);
                          }
                        });
                      }

                      // creator upline commission distribute start
                      const find_parent_id2 = async (id) => {
                        const a = await Matrix.findOne({ userId: id });
                        return a?.parentId;
                      };
                      let arr2 = [];
                      const find_upline2 = async (pr) => {
                        const id = await find_parent_id2(pr);
                        if (id) {
                          arr2.push(id);
                          await find_upline(id);
                        }
                      };
                      await find_upline2(userFound.referBy);
                      const perUp2 = creatorUplineCommission / arr2.length;
                      if (arr2.length > 0) {
                        await AdminWallet.updateOne(
                          { _id: findAmdinWalletFound._id },
                          { $inc: { balance: -creatorUplineCommission } }
                        );
                        arr2.map(async (item) => {
                          const fin = await User.findOne({ referalId: item });
                          if (fin.level <= 10) {
                            await Wallet.updateOne(
                              { userId: fin._id },
                              {
                                $inc: {
                                  balance: (
                                    Math.round(perUp2 * 100) / 100
                                  ).toFixed(2),
                                },
                              }
                            );
                            // create txn History
                            const repurchaseIncomeOfCreatorUpline = new Txn({
                              userId: fin._id,
                              recipientId: fin._id,
                              txnName: "Repurchase Income",
                              txnDesc: `You have get ${(
                                Math.round(perUp2 * 100) / 100
                              ).toFixed(2)} rupay as repurchase income.`,
                              txnAmount: (
                                Math.round(perUp2 * 100) / 100
                              ).toFixed(2),
                              txnType: "credit",
                              txnStatus: "TXN_SUCCESS",
                              txnResource: "Wallet",
                              txnId:
                                Math.floor(Math.random() * Date.now()) +
                                "repurchase" +
                                fin?.referalId,
                              orderId:
                                Math.floor(Math.random() * Date.now()) +
                                "repurchase" +
                                fin?.referalId,
                              ipAddress: getIpAddress(req),
                            });
                            await repurchaseIncomeOfCreatorUpline.save();

                            // notification
                            const notification = {
                              title: "Repurchase Income",
                              body: `You have get ${(
                                Math.round(perUp2 * 100) / 100
                              ).toFixed(2)} rupay as repurchase income.`,
                            };

                            const newNotification = new Notification({
                              ...notification,
                              recipient: fin._id,
                            });
                            await newNotification.save();

                            // send notification
                            fin?.deviceToken &&
                              sendNotification(notification, fin?.deviceToken);
                          }
                        });
                      }
                    }

                    // create txn history
                    const receiverTxn = new Txn({
                      userId: receiverUserFound._id,
                      recipientId: userFound._id,
                      txnName: "Received Money",
                      txnDesc: `Wallet Transfer Sender : ${userFound.phone} Receiver : ${receiverUserFound.phone}`,
                      txnAmount: payToReceiver,
                      txnType: "credit",
                      txnId:
                        Math.floor(Math.random() * Date.now()) + "received",
                      orderId:
                        Math.floor(Math.random() * Date.now()) + "received",
                      txnStatus: "TXN_SUCCESS",
                      txnResource: "Wallet",
                      mid: mid ? mid : "",
                      ipAddress: getIpAddress(req),
                    });
                    await receiverTxn.save();

                    // create txn history
                    const senderTxn = new Txn({
                      userId: userFound._id,
                      recipientId: receiverUserFound._id,
                      txnName: "Send Money",
                      txnDesc: `Wallet Transfer Sender : ${userFound.phone} Receiver : ${receiverUserFound.phone}`,
                      txnAmount: amount,
                      txnType: "debit",
                      txnId:
                        Math.floor(Math.random() * Date.now()) + "sendmoney",
                      orderId:
                        Math.floor(Math.random() * Date.now()) + "sendmoney",
                      txnStatus: "TXN_SUCCESS",
                      txnResource: "Wallet",
                      mid: mid ? mid : "",
                      ipAddress: getIpAddress(req),
                    });
                    await senderTxn.save();

                    const sendMoneyFound = await Txn.find({
                      userId: userFound._id,
                      txnName: "Send",
                      txnStatus: "TXN_SUCCESS",
                      txnAmount: { $gte: 100 },
                    });

                    // when he send greater than 100, then increase 2 goPoints
                    if (sendMoneyFound.length === 1) {
                      await Wallet.updateOne(
                        { userId: userFound._id },
                        { $inc: { goPoints: 2 } }
                      );
                    }

                    // update wallet of receiver & sender
                    await Wallet.findByIdAndUpdate(walletFound._id, {
                      $inc: { balance: -parseInt(amount) },
                    });

                    await Wallet.findByIdAndUpdate(receiverWalletFound._id, {
                      $inc: { balance: payToReceiver },
                    });

                    const notification = {
                      title: "Received Money",
                      body: `${amount} rupees received from ${userFound.firstName} ${userFound.lastName}`,
                    };
                    // save notification
                    const newNotification = new Notification({
                      ...notification,
                      recipient: receiverUserFound._id,
                      sender: userFound._id,
                    });
                    await newNotification.save();

                    // push notification
                    receiverUserFound.deviceToken &&
                      sendNotification(
                        notification,
                        receiverUserFound.deviceToken
                      );

                    // success handler
                    successHandler(req, res, {
                      Remarks: "Money sent success.",
                      ResponseStatus: 2,
                    });
                  } // if otp expired
                  else {
                    await Otp.deleteOne({ _id: foundOTP._id });
                    res.status(400);
                    throw new Error("OTP has expired.");
                  }
                }
              } else {
                // if insufficiant balance
                res.status(400);
                throw new Error("wallet balance low.");
              }
            } else {
              res.status(400);
              throw new Error("Invalid user wallet.");
            }
          } else {
            res.status(400);
            throw new Error("Invalid user wallet");
          }
        } else {
          res.status(400);
          throw new Error("next transaction will possible after 1 minute");
        }
      } else {
        res.status(400);
        throw new Error(
          Number(amount) <= 2000
            ? "You can send 2000 rs at a time"
            : "amount should be positive"
        );
      }
    } else {
      res.status(400);
      throw new Error("This service currently block");
    }
  } else {
    res.status(400);
    throw new Error("This service currently block");
  }
});

// donate money to company  --- push notification
const donateMoney = asyncHandler(async (req, res) => {
  const findService = await Service.findOne({ name: "DONATION" });
  if (findService.status) {
    const userFound = req.data;
    const { amount, mPin } = req.body;

    if (Number(amount) > 0) {
      if (!userFound.mPin) {
        res.status(400);
        throw new Error("please set mpin");
      }

      // decrypt mpin
      const decryptMpin = CryptoJS.AES.decrypt(
        userFound.mPin,
        CRYPTO_SECRET
      ).toString(CryptoJS.enc.Utf8);

      const currentTime = new Date();
      const oneMinuteAgo = new Date(currentTime - 60000); // 1 minute ago
      const lastTransaction = await Txn.findOne({
        userId: userFound._id,
        createdAt: { $gte: oneMinuteAgo, $lte: currentTime },
      }).sort({
        createdAt: -1,
      });

      if (!lastTransaction) {
        // update wallet of receiver & sender
        const walletFound = await Wallet.findOne({ userId: userFound._id });
        const receiverWalletFound = await AdminWallet.findOne();
        if (walletFound.balance >= amount) {
          if (mPin.toString() !== decryptMpin) {
            res.status(400);
            throw new Error("Please enter valid mPin");
          } else {
            // create txn history
            const donationGotHistory = new AdminTxn({
              adminId: receiverWalletFound._id,
              recipientId: receiverWalletFound._id,
              txnAmount: amount,
              remarks: `Received ${amount} rupay donation to our foundation `,
              txnType: "credit",
              txnId: Math.floor(Math.random() * Date.now()) + "donate",
              txnStatus: "TXN_SUCCESS",
              txnResource: "Foundation",
            });
            await donationGotHistory.save();

            // create txn history
            const senderTxn = new Txn({
              userId: userFound._id,
              txnName: "Donation",
              txnDesc: `You have donated ${amount} rupay to our foundation `,
              txnAmount: amount,
              txnType: "debit",
              txnId: Math.floor(Math.random() * Date.now()) + "donate",
              orderId: Math.floor(Math.random() * Date.now()) + "donate",
              txnStatus: "TXN_SUCCESS",
              txnResource: "Wallet",
              ipAddress: getIpAddress(req),
            });
            await senderTxn.save();

            // update wallet of receiver & sender
            const actual = walletFound.balance - parseInt(amount);
            await Wallet.findByIdAndUpdate(walletFound._id, {
              $set: { balance: actual },
            });
            receiverWalletFound &&
              (await AdminWallet.updateOne(
                { adminId: receiverWalletFound.adminId },
                { $inc: { foundation: amount } }
              ));

            // success handler
            successHandler(req, res, { Remarks: "Thanks for your donation" });
          }
        } else {
          // if insufficiant balance
          res.status(400);
          throw new Error("wallet balance low.");
        }
      } else {
        res.status(400);
        throw new Error("next transaction will possible after 1 minute");
      }
    } else {
      res.status(400);
      throw new Error("Amount Should be positive");
    }
  } else {
    res.status(400);
    throw new Error("This service currently block");
  }
});

// add money to wallet  --- push notification
const addMoney = asyncHandler(async (req, res, response) => {
  try {
    const userFound = await User.findById(response.userId);
    // const { _id, deviceToken } = req.data;
    // console.log(_id, '_id')

    // const { txnAmount } = req.body;
    const txnAmount = response.amount;

    const addToWallet = new Txn({
      userId: userFound._id,
      recipientId: userFound._id,
      txnName: "Add",
      txnDesc: `ADD_MONEY`,
      txnType: "credit",
      txnStatus: "TXN_SUCCESS",
      txnResource: "Online",
      orderId: response.txnid,
      txnId: response.txnid,
      txnAmount,
      ipAddress: getIpAddress(req),
      gatewayName: response.gatewayName || "",
    });
    await addToWallet.save();

    await Wallet.updateOne(
      { userId: userFound._id },
      { $inc: { balance: txnAmount } }
    );

    // notification
    const notification = {
      title: "Added Money",
      body: `₹${txnAmount} rupees added in your wallet`,
    };
    const newNotification = new Notification({
      ...notification,
      sender: userFound._id,
      recipient: userFound._id,
    });
    await newNotification.save();

    // send notification
    userFound.deviceToken &&
      sendNotification(notification, userFound.deviceToken);

    const handleFirstTransaction = async (userId, txnAmount) => {
      // Check if it's the user's first transaction over â‚¹100
      try {
        if (txnAmount >= 100) {
          const user = await User.findById(userId);

          if (user && user.referBy && !user.referBonus) {
            const referalFound = await User.findOne({
              referalId: user.referBy,
            });

            if (referalFound) {
              const GET_REFER_AMOUNT = await appSetting.findOne();

              // Credit the referral bonus
              await Wallet.updateOne(
                { userId: referalFound._id },
                { $inc: { balance: Number(GET_REFER_AMOUNT.referAmount) } }
              );

              // Save transaction recordui
              const refererTxnData = new Txn({
                userId: referalFound._id,
                recipientId: referalFound._id,
                txnName: "Referral Bonus",
                txnDesc: `Referral bonus ‚₹${GET_REFER_AMOUNT.referAmount}.`,
                txnAmount: Number(GET_REFER_AMOUNT.referAmount),
                txnType: "credit",
                txnId: Math.floor(Math.random() * Date.now()) + "refer",
                orderId: Math.floor(Math.random() * Date.now()) + "refer",
                txnStatus: "TXN_SUCCESS",
                txnResource: "Wallet",
                ipAddress: user.ipAddress,
              });
              await refererTxnData.save();
              await User.updateOne({ _id: user._id }, { referBonus: true });
            }
          }
        }
      } catch (error) {
        console.error("Error in handleFirstTransaction:", error);
        throw new Error("Failed to process referral bonus.");
      }
    };
    const userId = userFound._id;
    await handleFirstTransaction(userId, txnAmount);
    // success respond
    // successHandler(req, res, {
    //   Remarks: "Success fully added to wallet.",
    //   Data: response && response.amount,
    // });
  } catch (error) {
    throw new Error(error);
  }
});

// ---------------------------------- WithDraw Requests --------------------------------- //

// generate withdraw requuest
// const withdrawRequest = asyncHandler(async (req, res) => {
//   const findService = await Service.findOne({ name: "TRANSFER" });
//   if (findService.status) {
//     const { _id } = req.data;
//     const { amount, bankId } = req.body;
//     const bankFound = await Bank.findById(bankId);

//     if (!bankFound) {
//       res.status(400);
//       throw new Error("Invalid bank id.");
//     }
//     const discount = (amount / 100) * 15;
//     const finalAmount = amount + discount;
//     const findWallet = await Wallet.findOne({ userId: _id });

//     if (finalAmount < findWallet.balance) {
//       const newRequest = new Withdraw({ amount, bankId, userId: _id });
//       await newRequest.save();
//       await Wallet.updateOne(
//         { userId: _id },
//         { $inc: { balance: -finalAmount } }
//       );

//       // success response
//       successHandler(req, res, { Remarks: "Request submitted success." });
//     } else {
//       res.status(400);
//       throw new Error("Wallet balance low");
//     }
//   } else {
//     res.status(400);
//     throw new Error("This service currently block");
//   }
// });

// // manage withdraw requuest  --- push notification
// const manageWithdrwRequest = asyncHandler(async (req, res) => {
//   const { _id } = req.data;
//   const { withdrawId, status, message } = req.body;
//   const data = await Withdraw.findById(withdrawId);

//   if (!data) {
//     res.status(400);
//     throw new Error("Invalid withdraw id.");
//   }

//   if (status === "reject" && !message) {
//     res.status(400);
//     throw new Error("Please give reason to reject.");
//   }

//   const discount = (data.amount / 100) * 15;
//   const finalAmount = data.amount + discount;
//   const userFound = await User.findById(data.userId);

//   // notification
//   const notification = {
//     title: `Withdraw ${status}`,
//     body:
//       status === "reject"
//         ? `Your request rejected due to ${message}`
//         : `${data.amount} rupees sent in your bank`,
//   };
//   const newNotification = new Notification({
//     ...notification,
//     recipient: data.userId,
//   });
//   await newNotification.save();

//   // send notification
//   userFound?.deviceToken &&
//     sendNotification(notification, userFound?.deviceToken);

//   // if status reject
//   if (status === "reject") {
//     await Wallet.updateOne(
//       { userId: data.userId },
//       { $inc: { balance: finalAmount } }
//     );
//   }

//   // update admin wallet if status aprroved
//   if (status === "approved") {
//     // calculate charges
//     const serviceCharge = (data.amount / 100) * 10;
//     const foundationCharge = (data.amount / 100) * 5;

//     // update admin wallet
//     await AdminWallet.updateOne(
//       { adminId: _id },
//       { $inc: { balance: serviceCharge, foundation: foundationCharge } }
//     );

//     // service charge history
//     const serviceChargeBalanceHistory = new AdminTxn({
//       adminId: _id,
//       recipientId: _id,
//       txnAmount: serviceCharge,
//       remarks: `Received 10% service charge to our wallet`,
//       txnType: "credit",
//       txnId: Math.floor(Math.random() * Date.now()) + "dc",
//       txnStatus: "TXN_SUCCESS",
//       txnResource: "Wallet",
//     });
//     await serviceChargeBalanceHistory.save();

//     const serviceChargeFoundationHistory = new AdminTxn({
//       adminId: _id,
//       recipientId: _id,
//       txnAmount: foundationCharge,
//       remarks: `Received 5% service charge to our foundation`,
//       txnType: "credit",
//       txnId: Math.floor(Math.random() * Date.now()) + "fd",
//       txnStatus: "TXN_SUCCESS",
//       txnResource: "Foundation",
//     });
//     await serviceChargeFoundationHistory.save();
//   }

//   // create transaction
//   const newTxn = new Txn({
//     userId: data.userId,
//     recipientId: data.userId,
//     txnName: status === "reject" ? "Return Money" : "Withdraw Money",
//     txnDesc: `Wallet withdraw money ${status}`,
//     txnAmount: data.amount,
//     txnType: status === "reject" ? "credit" : "debit",
//     txnId: Math.floor(Math.random() * Date.now()) + "drawmoney",
//     orderId: Math.floor(Math.random() * Date.now()) + "drawmoney",
//     txnStatus: "TXN_SUCCESS",
//     txnResource: "Wallet",
//     ipAddress: getIpAddress(req),
//   });
//   await newTxn.save();
//   await Withdraw.findByIdAndUpdate(withdrawId, { $set: { status, message } });

//   // success response
//   successHandler(req, res, { Remarks: `Request ${status} success.` });
// });

// // withdraw requuest list to user
// const withdrwRequestList = asyncHandler(async (req, res) => {
//   const { _id } = req.data;
//   const data = await Withdraw.find({ userId: _id })
//     .populate("bankId")
//     .populate("userId");
//   // success response
//   successHandler(req, res, {
//     Remarks: `Fetch all withdraw request success.`,
//     Data: encryptFunc(data.reverse()),
//   });
// });

// // withdraw requuest list to admin
// const withdrwRequestListByAdmin = asyncHandler(async (req, res) => {
//   const data = await Withdraw.find().populate("bankId").populate("userId");
//   // success response
//   successHandler(req, res, {
//     Remarks: `Fetch all withdraw request success.`,
//     Data: encryptFunc(data.reverse()),
//   });
// });

// --------------------------------Send Money by Admin Transaction
const manageMoney = asyncHandler(async (req, res) => {
  const { _id, phone } = req.data;
  const { username, amount, type, otp, remarks, title } = req.body;
  const userFound = await User.findById(username);
  const userWalletFound = await Wallet.findOne({ userId: username });
  const adminWalletFound = await AdminWallet.findOne({ adminId: _id });

  if (!username || !amount || !type || !remarks) {
    res.status(400);
    throw new Error("Please fill all fields");
  } else {
    if (userWalletFound && adminWalletFound) {
      if (
        type === "credit"
          ? adminWalletFound[title] >= Number(amount)
          : userWalletFound[title] >= Number(amount)
      ) {
        if (!otp) {
          await Otp.deleteMany({ phone });
          const generatedOtp = generateOTP();
          await Otp.create({ phone, otp: generatedOtp });
          sendSMS(phone, generatedOtp);
          // Success Respond
          successHandler(req, res, {
            Remarks: "otp will receive sms",
            ResponseStatus: 3,
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
            // create transactions
            const userNewTxn = new Txn({
              userId: username,
              recipientId: username,
              txnName: (type === "credit" ? "Received" : "Debited") + "Money",
              txnDesc: remarks,
              txnAmount: Number(amount),
              txnType: type,
              txnId: Math.floor(Math.random() * Date.now()) + "receivedMoney",
              orderId: Math.floor(Math.random() * Date.now()) + "receivedMoney",
              txnStatus: "TXN_SUCCESS",
              txnResource:
                title === "balance"
                  ? "Wallet"
                  : title.charAt(0).toUpperCase() + title.slice(1),
              ipAddress: getIpAddress(req),
            });
            await userNewTxn.save();
            const adminNewTxn = new AdminTxn({
              adminId: _id,
              recipientId: type === "credit" ? username : _id,
              txnAmount: Number(amount),
              remarks: remarks,
              txnType: type === "credit" ? "debit" : "credit",
              txnId: Math.floor(Math.random() * Date.now()),
              txnStatus: "TXN_SUCCESS",
              txnResource:
                title === "balance"
                  ? "Wallet"
                  : title.charAt(0).toUpperCase() + title.slice(1),
            });
            await adminNewTxn.save();

            // update wallet
            await Wallet.findByIdAndUpdate(userWalletFound._id, {
              $inc: {
                [title]: type === "credit" ? Number(amount) : -Number(amount),
              },
            });

            await AdminWallet.findByIdAndUpdate(adminWalletFound._id, {
              $inc: {
                [title]: type === "credit" ? -Number(amount) : Number(amount),
              },
            });

            // notification body
            const notification = {
              title: type === "credit" ? "Credited" : "Debited",
              body: `${amount} ${title === "balance" ? "Rupee" : title
                } Received from Aadyapay.`,
            };
            const newNotification = new Notification({
              ...notification,
              recipient: username,
            });
            await newNotification.save();

            // send notification
            userFound?.deviceToken &&
              sendNotification(notification, userFound.deviceToken);

            // success respond
            successHandler(req, res, { Remarks: "transfer success" });
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
        throw new Error(
          `insufficient ${type === "credit" ? "your" : "user"} ${title} balance`
        );
      }
    } else {
      res.status(400);
      throw new Error("Invalid user name");
    }
  }
});

const userWallet = asyncHandler(async (req, res) => {
  let payload = { ...req.query };

  // (Optional) Convert userId to ObjectId if present
  if (payload.userId) {
    payload.userId = payload.userId.trim();
  }

  // Prevent unsafe mongo operators
  Object.keys(payload).forEach(key => {
    if (key.startsWith("$")) delete payload[key];
  });

  const wallet = await Wallet.find(payload).populate("userId");

  return successHandler(req, res, {
    Remarks: wallet && wallet.length > 0 ? "All user wallet data" : "No wallet data found",
    Data: wallet ?? []
  });
});


const cashback = asyncHandler(async (req, res) => {
  const { serviceId, amount, opName } = req.body;

  console.log("[STEP-1] Received serviceId:", serviceId);

  if (!serviceId) {
    res.status(400);
    throw new Error("Service ID is required");
  }

  const service = await Service.findById(serviceId);
  console.log("[STEP-2] Service found");

  if (!service) {
    res.status(404);
    throw new Error("Service not found");
  }

  // Try to find the commission by operator name
  let commission = await Commission.findOne({
    serviceId,
    status: true,
    name: new RegExp(`^${opName}$`, "i"),
  });

  console.log("[STEP-3] Commission lookup by operator name:");

  if (!commission) {
    console.log("[STEP-3.1] Commission not found for operator name:", opName);

    // If no commission is found by operator name, find the commission with the lowest cashback percentage
    commission = await Commission.findOne({
      serviceId,
      status: true,
    }).sort({ commission: 1 });  // Sort by commission percentage (ascending)

    if (!commission) {
      res.status(404);
      throw new Error(`No valid commission found for serviceId: ${serviceId}`);
    }

    console.log("[STEP-3.2] Fallback commission found with the lowest cashback:", commission.commission);
  }

  console.log("[STEP-4] Commission found:", commission.commission);

  // Calculate cashback amount
  let cashbackAmount = (commission.commission / 100) * amount;
  cashbackAmount = parseFloat(cashbackAmount.toFixed(2));
  console.log("[STEP-6] Cashback calculated:", cashbackAmount);

  // Send response
  successHandler(req, res, {
    Remarks: "Cashback amount fetched successfully",
    data: {
      Cashback: cashbackAmount,
      type: "cashback",
      category: commission.operatorType,
      unit: "₹",
    }
  });
});


const manageUserWalletMoney = asyncHandler(async (req, res) => {
  // Implementation here
  const { _id } = req.data;
  const service = await Service.findOne({ name: "ADD_MONEY" });
  if (!service.status) {
    res.status(400);
    throw new Error("This service currently block");
  }
  console.log("admin id", _id)
  const adminWallet = await Admin.findById(_id).populate('wallet');
  // if(!adminWallet){
  //   res.status(400);
  //   throw new Error("Admin wallet not found");
  // }
  // if(!adminWallet.status || !adminWallet.userId.status){
  //   res.status(400);
  //   throw new Error("Admin wallet is inactive");
  // }
  // if(adminWallet.balance < req.body.amount || adminWallet.balance <=0){
  //   res.status(400);
  //   throw new Error("Insufficient admin wallet balance");
  // }

  console.log("Admin Wallet:", adminWallet);
  const { userId, amount, type } = req.body;
  const txnAmount = Number(amount);

  if (!["credit", "debit"].includes(type)) {
    res.status(400);
    throw new Error("Invalid type, must be credit or debit");
  }

  if (!userId || !txnAmount || txnAmount <= 0) {
    console.log("Invalid userId or amount:", { userId, amount });
    res.status(400);
    throw new Error("Please provide valid userId and amount");
  }

  if (Number(amount) > 2000) {
    res.status(400);
    throw new Error("Maximum ₹2000 allowed per transaction");
  }
  const userWallet = await Wallet.findOne({ userId: userId }).populate('userId');
  if (!userWallet) {
    res.status(400);
    throw new Error("User wallet not found");
  }
  if (!userWallet.userId.status) {
    console.log("User wallet or user is inactive", userWallet.userId.status);
    res.status(400);
    throw new Error("User wallet is inactive");
  }
  // Debit admin wallet

if (type === "credit") {

  const adminNewTxn = new AdminTxn({
    adminId:adminWallet._id,
    recipientId: userId,
    txnAmount: txnAmount,
    remarks: `Admin credited ₹${txnAmount} to user wallet`,
    txnType: "debit",
    txnId: Math.floor(Math.random() * Date.now()) + "adminCredit",
    txnStatus: "TXN_SUCCESS",
    txnResource: "Wallet",
  });
  await adminNewTxn.save();

  successHandler(req, res, {
    remark: "Amount credited to user wallet successfully",
    amount: txnAmount,
  });
if(type === "debit"){
  successHandler(req, res, {
    remark: "Amount debited from user wallet successfully",
    amount: txnAmount,
  });
}
}
});

// wallet info
const getWalletByUser = asyncHandler(async (req, res) => {
  const { _id } = req.data;
  const data = await Wallet.findOne({ userId: _id });
  // i want to give only 2 frectional digit in balance
  if (data) {
    data.balance = parseFloat(data.balance).toFixed(2);
  }
  successHandler(req, res, { Remarks: "Fetch wallet by user", Data: data });
});


module.exports = {
  userCheck,
  addMoney,
  // getWalletByAdmin,
  getWalletByUser,
  donateMoney,
  sendMoney,
  manageMoney,
  cashback,
  manageUserWalletMoney,
  userWallet,
  getWalletTxn
};
