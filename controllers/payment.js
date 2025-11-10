const User = require("../models/userSchema");
const express = require("express");
const Wallet = require("../models/walletSchema");
const Service = require("../models/serviceSchema");
const Transaction = require("../models/txnSchema");
const Notification = require("../models/notificationSchema");
const Recharge = require("../models/service/rechargeSchema");
const RazorpaySchema = require("../models/razorpaySchema");
const RazorpayOrder = require("../models/razOrderSchema");
const getIpAddress = require("../common/getIpAddress");
const crypto = require("crypto");
const Razorpay = require("razorpay");
const { addMoney } = require("./wallet");
const asyncHandler = require("express-async-handler");
const { giftCardBuy } = require("./user");
const successHandler = require("../common/successHandler");
const sendNotification = require("../common/sendNotification");
const CryptoJS = require("crypto-js");
const {
  generateOrderId,
  GeneratePayuTxnId,
} = require("../common/generateOrderId");
const CashfreeOrder = require("../models/cashfreeOrderSchema");
const OnegatewayOrder = require("../models/onegatewayOrderSchema");
const { default: axios } = require("axios");
const { Cashfree } = require("cashfree-pg");
const dthSchema = require("../models/service/dthSchema");
const sendEmail = require("../common/sendEmail");
const appSetting = require("../models/appSetting");
const txnSchema = require("../models/txnSchema");
const { getPaygicTokenFromDB } = require("../common/paygicTokenGenerate");
const PaygicOrder = require("../models/paygicOrderSchema");
const PaymentGateway = require("../models/paymentGatewaySchema");
const fetch = require("node-fetch");
const {
  generatePayuHash,
  verifyPaymentPayuHash,
} = require("../common/PayuHashGenerate");
const payuOrderSchema = require("../models/payuOrderSchema");
const CRYPTO_SECRET = process.env.CRYPTO_SECRET;
const app = express();
const qs = require("qs");
const querystring = require("querystring");
const onegatewayOrderSchema = require("../models/onegatewayOrderSchema");
const rechargePaymentGateway = require("../models/rechargePaymentGateway");

// Initialize Cashfree
Cashfree.XClientId = process.env.CASHFREE_CLIENT_ID;
Cashfree.XClientSecret = process.env.CASHFREE_CLIENT_SECRET;
Cashfree.XEnvironment = Cashfree.Environment.PRODUCTION;
const razorpayKey = process.env.RAZORPAY_KEY || "rzp_live_932jSNsVCimz53";
const razorpaySecret =
  process.env.RAZORPAY_SECRET || "g6aRV5Z8QVJJooCfuLZeyD71";

const razorpay = new Razorpay({
  key_id: razorpayKey,
  key_secret: razorpaySecret,
});

const handleFirstTransaction = async (userId, txnAmount) => {
  // Check if it's the user's first transaction over â‚¹100
  try {
    if (txnAmount >= 100) {
      const user = await User.findById(userId);

      if (user && user.referBy && !user.referBonus) {
        const referalFound = await User.findOne({ referalId: user.referBy });

        if (referalFound) {
          const GET_REFER_AMOUNT = await appSetting.findOne();

          // Credit the referral bonus
          await Wallet.updateOne(
            { userId: referalFound._id },
            { $inc: { balance: Number(GET_REFER_AMOUNT.referAmount) } }
          );

          // Save transaction recordui
          const refererTxnData = new txnSchema({
            userId: referalFound._id,
            recipientId: referalFound._id,
            txnName: "Referral Bonus",
            txnDesc: `Referral Bonus ₹${GET_REFER_AMOUNT.referAmount}.`,
            txnAmount: Number(GET_REFER_AMOUNT.referAmount),
            txnType: "credit",
            txnId: Math.floor(Math.random() * Date.now()) + "referBonus",
            orderId: Math.floor(Math.random() * Date.now()) + "referBonus",
            txnStatus: "TXN_SUCCESS",
            txnResource: "Wallet",
            ipAddress: user.ipAddress,
          });
          await refererTxnData.save();
          await User.updateOne({ _id: user._id }, { referBonus: true });
        }
      }
    } else {
    }
  } catch (error) {
    console.error("Error in handleFirstTransaction:", error);
    throw new Error("Failed to process referral bonus.");
  }
};

// const handleCashback = async (
//   FindUser,
//   cashbackPercent,
//   txnId,
//   ipAddress,
//   walletFound
// ) => {
//   try {
//     const addCashBack = new Transaction({
//       userId: FindUser._id,
//       recipientId: FindUser._id,
//       txnName: "Cashback",
//       txnDesc: `You got ₹${cashbackPercent.toFixed(2)} cashback`,
//       txnType: "credit",
//       txnStatus: "TXN_SUCCESS",
//       txnResource: "Wallet",
//       txnId: txnId + "cashback",
//       orderId: txnId + "cashback",
//       txnAmount: cashbackPercent,
//       ipAddress,
//     });

//     await Wallet.findByIdAndUpdate(walletFound._id, {
//       $inc: { balance: cashbackPercent },
//     });

//     await addCashBack.save();

//     const notification = {
//       title: "Received Cashback",
//       body: `Hurray! You got ₹${cashbackPercent.toFixed(2)} as a cashback.`,
//     };

//     const newNotification = new Notification({
//       ...notification,
//       recipient: FindUser._id,
//     });

//     await newNotification.save();

//     // Send notification
//     if (FindUser?.deviceToken) {
//       sendNotification(notification, FindUser.deviceToken);
//     }
//   } catch (error) {
//     console.error("Cashback handling error:", error);
//     throw new Error("Failed to handle cashback.");
//   }
// };

const handleCashback = async (
  FindUser,
  cashbackPercent,
  txnId,
  ipAddress,
  walletFound
) => {
  try {
    const addCashBack = new Transaction({
      userId: FindUser._id,
      recipientId: FindUser._id,
      txnName: "Cashback",
      txnDesc: `Cashback ₹${cashbackPercent?.toFixed(2) || 0}, TXN_ID ${txnId}`,
      txnType: "credit",
      txnStatus: "TXN_SUCCESS",
      txnResource: "Wallet",
      txnId: txnId + "cashback",
      orderId: txnId + "cashback",
      txnAmount: cashbackPercent?.toFixed(2) || 0,
      ipAddress,
    });

    await Wallet.findByIdAndUpdate(walletFound._id, {
      $inc: { balance: cashbackPercent },
    });

    await addCashBack.save();

    const notification = {
      title: "Received Cashback",
      body: `Hurray! 🎉 You got ₹${
        cashbackPercent.toFixed(2) || 0
      } as a cashback.`,
    };

    const newNotification = new Notification({
      ...notification,
      recipient: FindUser._id,
    });

    await newNotification.save();

    // Send notification
    if (FindUser?.deviceToken) {
      sendNotification(notification, FindUser.deviceToken);
    }
  } catch (error) {
    console.error("Cashback handling error:", error);
    throw new Error("Failed to handle cashback.");
  }
};

// const handleRefund = async (
//   FindUser,
//   amount,
//   transactionId,
//   ipAddress,
//   walletFound
// ) => {
//   try {
//     const refundAmount = new Transaction({
//       userId: FindUser._id,
//       recipientId: FindUser._id,
//       txnName: "Refund",
//       txnDesc: `Your ₹${amount} is Refunded.`,
//       txnType: "credit",
//       txnStatus: "TXN_SUCCESS",
//       txnResource: "Wallet",
//       txnId: transactionId + "refund",
//       orderId: transactionId + "refund",
//       txnAmount: amount,
//       ipAddress: ipAddress,
//     });

//     await Wallet.findByIdAndUpdate(walletFound._id, {
//       $inc: {
//         balance: Number(amount),
//       },
//     });

//     await refundAmount.save();
//   } catch (error) {
//     console.error("Refund handling error:", error);
//     throw new Error("Failed to handle refund.");
//   }
// };

const handleRefund = async (
  FindUser,
  TxnAmount,
  transactionId,
  ipAddress,
  walletFound
) => {
  try {
    const refundAmount = new Transaction({
      userId: FindUser._id,
      recipientId: FindUser._id,
      txnName: "Refund",
      txnDesc: `Refund ₹${TxnAmount}, TXN_ID ${transactionId} .`,
      txnType: "credit",
      txnStatus: "TXN_SUCCESS",
      txnResource: "Wallet",
      txnId: transactionId + "refund",
      orderId: transactionId + "refund",
      txnAmount: TxnAmount,
      ipAddress: ipAddress,
    });

    await Wallet.findByIdAndUpdate(walletFound._id, {
      $inc: {
        balance: TxnAmount,
      },
    });

    await refundAmount.save();
  } catch (error) {
    console.error("Refund handling error:", error);
    throw new Error("Failed to handle refund.");
  }
};

const handleDisputeRefund = async (
  userFound,
  findTxn,
  findCashbackTxn,
  TransID,
  ipAddress,
  walletFound
) => {
  try {
    const ActualAmount = findCashbackTxn
      ? findTxn.txnAmount - findCashbackTxn.txnAmount
      : findTxn.txnAmount;

    const refundAmount = new Transaction({
      userId: userFound._id,
      recipientId: userFound._id,
      txnName: "Refund",
      txnDesc: `Your ₹${ActualAmount} is Refunded.`,
      txnType: "credit",
      txnStatus: "TXN_SUCCESS",
      txnResource: "Wallet",
      txnId: TransID + "refund",
      orderId: TransID + "refund",
      txnAmount: ActualAmount,
      ipAddress: ipAddress,
    });

    await Wallet.findByIdAndUpdate(walletFound._id, {
      $inc: {
        balance: Number(ActualAmount),
      },
    });

    await refundAmount.save();
  } catch (error) {
    console.error("Refund handling error:", error);
    throw new Error("Failed to handle refund.");
  }
};

// @desc Pay With Wallet
// @path /api/payment/wallet
// const paywithWallet = asyncHandler(async (req, res) => {
//   const { mPin, txnAmount,orderId, txnId, serviceId, userId, ipAddress } = req.body;

//   const userFound = await User.findById(userId);
//     if(!userFound.status){
//       res.status(400);
//     throw new Error("User is Blocked");
//   }
//   const walletFound = await Wallet.findOne({ userId: userFound._id });

//   if (Number(txnAmount) <= 0) {
//     res.status(400);
//     throw new Error("TxnAmount Should be positive");
//   }

//   if (!userFound.mPin) {
//     res.status(400);
//     throw new Error("Please set mpin");
//   }

//   // Decrypt mpin
//   const decryptMpin = CryptoJS.AES.decrypt(
//     userFound.mPin,
//     CRYPTO_SECRET
//   ).toString(CryptoJS.enc.Utf8);

//   if (mPin.toString() !== decryptMpin) {
//     res.status(400);
//     throw new Error("Please enter a valid mPin");
//   }

//   const serviceData = serviceId ? await Service.findById(serviceId) : null;

//   if (serviceId && !serviceData) {
//     res.status(400);
//     throw new Error("Please enter a valid ServiceId");
//   }

//   if (walletFound.balance < Number(txnAmount)) {
//     res.status(400);
//     throw new Error("Wallet balance is low");
//   }

//   const payAmount = parseInt(txnAmount);

//   // ----------- Create Txn History ------------- //
//   const subtractBalance = new Transaction({
//     userId: userFound._id,
//     recipientId: userFound._id,
//     txnName: serviceData?.name || "Service",
//     txnDesc: `You have used the ${serviceData?.name} service.`,
//     txnAmount: payAmount,
//     txnType: "debit",
//     txnStatus: "TXN_SUCCESS",
//     txnResource: "Wallet",
//     serviceId,
//     txnId,
//     orderId: txnId,
//     ipAddress,
//   });

//   await subtractBalance.save();

//   // Update Wallet Balance
//   await Wallet.findByIdAndUpdate(walletFound._id, {
//     $inc: { balance: -payAmount },
//   });

//   // Handle First Transaction
//   // await handleFirstTransaction(userFound._id, txnAmount);

//   // Success Response
//   return { ResponseStatus: 1 };
// });

const paywithWallet = asyncHandler(async (req, res) => {
  const { mPin, txnAmount, txnId, serviceId, userId, ipAddress } = req.body;

  const userFound = await User.findById(userId);
  if (!userFound.status) {
    res.status(400);
    throw new Error("User is Blocked");
  }
  const walletFound = await Wallet.findOne({ userId: userFound._id });

  if (txnAmount <= 0) {
    res.status(400);
    throw new Error("TxnAmount Should be positive");
  }

  if (!userFound.mPin) {
    res.status(400);
    throw new Error("Please set mpin");
  }

  // Decrypt mpin
  const decryptMpin = CryptoJS.AES.decrypt(
    userFound.mPin,
    CRYPTO_SECRET
  ).toString(CryptoJS.enc.Utf8);

  if (mPin.toString() !== decryptMpin) {
    res.status(400);
    throw new Error("Please enter a valid mPin");
  }

  const serviceData = serviceId ? await Service.findById(serviceId) : null;

  if (serviceId && !serviceData) {
    res.status(400);
    throw new Error("Please enter a valid ServiceId");
  }

  if (walletFound.balance < txnAmount) {
    res.status(400);
    throw new Error("Wallet balance is low");
  }

  const payAmount = txnAmount;

  // ----------- Create Txn History ------------- //
  const subtractBalance = new Transaction({
    userId: userFound._id,
    recipientId: userFound._id,
    txnName: serviceData?.name || "Service",
    txnDesc: `${serviceData?.name} service.`,
    txnAmount: payAmount,
    txnType: "debit",
    txnStatus: "TXN_SUCCESS",
    txnResource: "Wallet",
    serviceId,
    txnId,
    orderId: txnId,
    ipAddress,
  });

  await subtractBalance.save();

  // Update Wallet Balance
  const updatedWallet = await Wallet.findOneAndUpdate(
    { _id: walletFound._id, balance: { $gte: payAmount } }, // Balance check included
    { $inc: { balance: -payAmount } },
    { new: true }
  );

  if (!updatedWallet) {
    res.status(400);
    throw new Error("Wallet balance is low or deduction failed");
  }

  // Handle First Transaction
  // await handleFirstTransaction(userFound._id, txnAmount);

  // Success Response
  return { ResponseStatus: 1 };
});

// ----------------------------- RAZORPAY PAYMENT GATEWAY ----------------------------- //

// Utility function to calculate the signature
function calculateSignature(data, secretKey) {
  const signature = crypto
    .createHmac("sha256", secretKey)
    .update(data.razorpay_order_id + "|" + data.razorpay_payment_id)
    .digest("hex");
  return signature;
}

// Function to create order id
const createOrderId = asyncHandler(async (req, res) => {
  const { _id } = req.data;
  const { amount } = req.body;

  const FindUser = await User.findOne({ _id });

  if (!FindUser.status) {
    res.status(400);
    throw new Error("User is Blocked");
  }

  if (FindUser.addMoney) {
    if (Number(amount) >= 10) {
      //   const currentTime = new Date();
      //   const oneMinuteAgo = new Date(currentTime - 60000); // 1 minute ago
      //   const lastTransaction = await Transaction.findOne({
      //     userId: _id,
      //     createdAt: { $gte: oneMinuteAgo, $lte: currentTime },
      //   }).sort({
      //     createdAt: -1,
      //   });

      //   if (!lastTransaction) {
      // Create an order in Razorpay
      const options = {
        amount: parseInt(amount) * 100, // Amount in paise (rupees * 100)
        currency: "INR",
      };

      try {
        const order = await razorpay.orders.create(options);
        const newRazorpayOrder = new RazorpayOrder({
          amount: order.amount,
          razorpay_order_id: order.id,
        });
        await newRazorpayOrder.save();
        res.json(order);
      } catch (error) {
        res.status(500).json({ error: "Failed to create order" });
      }
      //   } else {
      //     res.status(400);
      //     throw new Error("next transaction will possible after 1 minute");
      //   }
    } else {
      res.status(400);
      throw new Error("minimum 50 rupay add to wallet");
    }
  } else {
    res.status(400);
    throw new Error("This service is Temporary Down");
  }
});

// Create Cashfree Order ID
const createCashfreeOrderId = asyncHandler(async (req, res) => {
  try {
    const { _id } = req.data;
    const { amount } = req.body;
    const findService = await Service.findOne({ name: "ADD_MONEY" });
    if (!findService.status) {
      res.status(400);
      throw new Error("This service Temporarily Down");
    }

    // Find the user
    const FindUser = await User.findOne({ _id });

    if (!FindUser.addMoney) {
      res.status(400);
      throw new Error("This service is Temporary Down");
    }

    // if (Number(amount) < 50) {
    //   res.status(400);
    //   throw new Error("Minimum 50 rupees required to add to wallet");
    // }

    // Create order request
    const request = {
      order_amount: amount,
      order_currency: "INR",
      order_id: generateOrderId(),
      customer_details: {
        customer_id: _id,
        customer_phone: FindUser.phone,
      },
    };

    try {
      // Create order in Cashfree
      const response = await Cashfree.PGCreateOrder("2025-01-01", request);
      const responseData = response.data;

      // Save order details in the database
      const newCashfreeOrder = new CashfreeOrder({
        userId: FindUser._id,
        amount: responseData.order_amount,
        orderId: responseData.order_id,
        cashfree_order_id: responseData.cf_order_id,
        payment_session_id: responseData.payment_session_id,
        status: "PENDING",
      });
      await newCashfreeOrder.save();

      res.json(responseData);
    } catch (error) {
      console.error(
        "Error setting up order request:",
        error.response ? error.response.data : error.message
      );
      res.status(500).json({
        error: "Error setting up order request",
        details: error.response ? error.response.data : error.message,
      });
    }
  } catch (error) {
    throw new Error(error);
  }
});

// Create OneGatewayOrderId
// const createOneGatewayOrderId = asyncHandler(async (req, res) => {
//   try {
//     const { _id } = req.data;
//     const { amount } = req.body;
//     const findService = await Service.findOne({ name: "ADD_MONEY" });
//     if (!findService.status) {
//       res.status(400);
//       throw new Error("This service Temporarily Down");
//     }

//     // Find the user
//     const FindUser = await User.findOne({ _id });

//     if (!FindUser.addMoney) {
//       res.status(400);
//       throw new Error("This service is Temporary Down");
//     }

//     // if (Number(amount) < 50) {
//     //   res.status(400);
//     //   throw new Error("Minimum 50 rupees required to add to wallet");
//     // }

//     // Create order request
//     const request = {
//       scannerIncluded: false,
//       apiKey: process.env.ONEGATEWAY_API_KEY,
//       amount: amount,
//       paymentNote: "Add Money",
//       customerName: FindUser.firstName,
//       customerEmail: FindUser.email,
//       customerNumber: FindUser.phone,
//       orderId: generateOrderId(),
//     };

//     try {
//       const response = await axios.post(
//         "https://backend.onegateway.in/payment/intent-flow/initiate",
//         request
//       );
//       const responseData = response.data;
//       const newOnegatewayOrder = new OnegatewayOrder({
//         userId: FindUser._id,
//         amount: amount,
//         orderId: responseData.data.orderId,
//         status: "PENDING",
//       });
//       await newOnegatewayOrder.save();

//       res.json(responseData);
//     } catch (error) {
//       console.error(
//         "Error setting up order request:",
//         error.response ? error.response.data : error.message
//       );
//       res.status(500).json({
//         error: "Error setting up order request",
//         details: error.response ? error.response.data : error.message,
//       });
//     }
//   } catch (error) {
//     throw new Error(error);
//   }
// });

// Create Paygic Order
const createPaygicOrderId = asyncHandler(async (req, res) => {
  try {
    const { _id } = req.data;
    const { amount } = req.body;
    const findService = await Service.findOne({ name: "ADD_MONEY" });
    if (!findService.status) {
      res.status(400);
      throw new Error("This service Temporarily Down");
    }

    // Find the user
    const FindUser = await User.findOne({ _id });
    if (!FindUser.status) {
      res.status(400);
      throw new Error("User is Blocked");
    }

    if (!FindUser.addMoney) {
      res.status(400);
      throw new Error("This service is Temporary Down");
    }
    const paygicTokenNew = await getPaygicTokenFromDB(); // Fetch token dynamically
    if (Number(amount) < 10) {
      res.status(400);
      throw new Error("Minimum 10 rupees required to add to wallet");
    }

    // Create order request

    const request = {
      mid: process.env.PAYGIC_MID,
      amount: amount,
      merchantReferenceId: generateOrderId(),
      customer_name: FindUser.firstName,
      customer_email: FindUser.email,
      customer_mobile: FindUser.phone,
    };

    try {
      // Create order in Cashfree
      const response = await axios.post(
        "https://server.paygic.in/api/v2/createPaymentRequest",
        request,
        {
          headers: {
            token: paygicTokenNew,
          },
        }
      );
      if (!response.data.status) {
        res.status(400);
        throw new Error(response.data.msg);
      }
      // // Save order details in the database
      const newPaygicOrder = new PaygicOrder({
        userId: _id,
        amount: amount,
        merchantReferenceId: response.data.data.merchantReferenceId,
        paygicReferenceId: response.data.data.paygicReferenceId,
        status: "PENDING",
      });
      await newPaygicOrder.save();
      res.json(response.data);
    } catch (error) {
      console.error(
        "Error setting up order request:",
        error.response ? error.response.data : error.message
      );
      res.status(500).json({
        error: "Error setting up order request",
        details: error.response ? error.response.data : error.message,
      });
    }
  } catch (error) {
    throw new Error(error);
  }
});

const getCashfreePaymentStatus = asyncHandler(async (req, res) => {
  try {
    const { orderId } = req.body;

    const response = await Cashfree.PGOrderFetchPayments("2025-01-01", orderId);

    if (response?.data) {
      res.json(response.data);
    } else {
      res.status(404).json({ error: "No data found for this order" });
    }
  } catch (error) {
    console.error(
      "Error fetching order payments:",
      error?.response?.data?.message || error.message
    );
    res.status(500).json({
      error: "Error fetching order payments",
      details: error?.response?.data || error.message,
    });
  }
});

// Payment Callback
const paymentCallback = asyncHandler(async (req, res) => {
  const responseData = req.body;
  const { razorpay_signature, razorpay_payment_id, razorpay_order_id } =
    responseData;

  const findRazorpayOrder = await RazorpayOrder.findOne({
    razorpay_order_id,
    status: false,
  });

  if (findRazorpayOrder) {
    const newRazorpayRecord = new RazorpaySchema({
      razorpay_signature,
      razorpay_payment_id,
      razorpay_order_id,
    });

    const findSaveCredByOrder = await RazorpaySchema.findOne({
      razorpay_order_id,
    });
    const findSaveCredByPayment = await RazorpaySchema.findOne({
      razorpay_payment_id,
    });
    const findSaveCredBySign = await RazorpaySchema.findOne({
      razorpay_signature,
    });

    if (
      findSaveCredByOrder?.status ||
      findSaveCredByPayment?.status ||
      findSaveCredBySign?.status
    ) {
      res.status(400);
      throw new Error("Invalid credentials");
    } else {
      // Verify the received signature to ensure authenticity
      const receivedSignature = responseData.razorpay_signature;
      // Remove the signature from the data for verification
      const calculatedSignature = calculateSignature(
        responseData,
        razorpaySecret
      );

      if (receivedSignature === calculatedSignature) {
        // save used cred
        const newRazorpayRecord = new RazorpaySchema({
          razorpay_signature,
          razorpay_payment_id,
          razorpay_order_id,
        });
        newRazorpayRecord.status = true; // used
        await newRazorpayRecord.save();

        if (responseData?.purpose === "GiftCard") {
          giftCardBuy(req, res, {
            ...responseData,
            amount: findRazorpayOrder.amount / 100,
          }); // covert paise in rupay
        } else {
          addMoney(req, res, {
            ...responseData,
            amount: findRazorpayOrder.amount / 100,
          }); // covert paise in rupay
        }
        await RazorpayOrder.findByIdAndUpdate(findRazorpayOrder.id, {
          $set: { status: true },
        });
      } else {
        await newRazorpayRecord.save();
        res.status(400).send("Invalid signature");
      }
    }
  } else {
    res.status(400);
    throw new Error("invalid razorpay order id");
  }
});

const cashfreePaymentCallback = asyncHandler(async (req, res) => {
  try {
    const signature = req.headers["x-webhook-signature"];
    const timestamp = req.headers["x-webhook-timestamp"];
    const rawBody = req.rawBody;

    const isValid = Cashfree.PGVerifyWebhookSignature(
      signature,
      rawBody,
      timestamp
    );
    if (!isValid) {
      return res.status(400).json({ error: "Invalid signature" });
    }

    const responseData = req.body;
    const { order_id } = responseData.data.order;

    if (!order_id) {
      return res
        .status(400)
        .json({ error: "Order ID is missing in the callback data" });
    }

    // Find and update Cashfree order
    const findCashfreeOrder = await CashfreeOrder.findOneAndUpdate(
      { orderId: order_id, status: "PENDING" },
      { $set: { status: responseData?.data?.payment?.payment_status } },
      { new: true }
    );

    // Check if the order exists before proceeding
    if (!findCashfreeOrder) {
      return res
        .status(400)
        .json({ error: "Invalid or already processed Cashfree order ID" });
    }

    // Send email notification after finding order

    // Proceed to add money if the payment is successful
    if (responseData?.data?.payment?.payment_status === "SUCCESS") {
      try {
        await addMoney(req, res, {
          ...responseData,
          amount: findCashfreeOrder.amount,
          userId: findCashfreeOrder.userId,
          gatewayName: "CASHFREE",
          txnid: order_id,
        });
      } catch (error) {
        console.error("Error processing addMoney:", error);
        return res
          .status(500)
          .json({ error: "Error processing wallet credit" });
      }
    }

    res.json({ message: "Callback processed successfully" });
  } catch (error) {
    console.error("Error in Cashfree callback:", error);
    res.status(500).json({ error: "Error processing Cashfree callback" });
  }
});

// const OneGatewayPaymentCallback = asyncHandler(async (req, res) => {
//   try {
//     const responseData = req.body;
//     const { orderId } = responseData;

//     // Check for the order ID in the request
//     if (!orderId) {
//       res.status(400);
//       throw new Error("Order ID is missing in the callback data");
//     }

//     // Find the Cashfree order by `order_id` with a pending status
//     const findOnegatewayOrder = await OnegatewayOrder.findOne({
//       orderId: orderId,
//       status: "PENDING",
//     });

//     if (!findOnegatewayOrder) {
//       res.status(400);
//       throw new Error("Invalid or already processed Cashfree order ID");
//     }

//     // Proceed to add money or handle as necessary

//     if (responseData.status === "success") {
//       await addMoney(req, res, {
//         ...responseData,
//         amount: findOnegatewayOrder.amount,
//         userId: findOnegatewayOrder.userId,
//       });
//     }
//     // Update the order status to "COMPLETED"
//     await OnegatewayOrder.findByIdAndUpdate(OnegatewayOrder._id, {
//       $set: { status: responseData.status?.toUpperCase() },
//     });

//     res.send("Callback processed successfully");
//   } catch (error) {
//     res.send("Error processing Cashfree callback");
//   }
// });

// OneGateway Verify Status
// const getOneGatewayPaymentStatus = asyncHandler(async (req, res) => {
//   try {
//     const { orderId } = req.body;

//     const request = {
//       apiKey: process.env.ONEGATEWAY_API_KEY,
//       orderId: orderId,
//     };

//     const response = await axios.post(
//       "https://backend.onegateway.in/payment/status",
//       request
//     );

//     if (response?.data) {
//       res.json(response.data);
//     } else {
//       res.status(404).json({ error: "No data found for this order" });
//     }
//   } catch (error) {
//     console.error(
//       "Error fetching order payments:",
//       error?.response?.data?.message || error.message
//     );
//     res.status(500).json({
//       error: "Error fetching order payments",
//       details: error?.response?.data || error.message,
//     });
//   }
// });

// Paygic Payment Callback
const PaygicPaymentCallback = asyncHandler(async (req, res) => {
  try {
    const responseData = req.body;
    const paygicTokenNew = await getPaygicTokenFromDB();

    // Status Check API call
    const statusCheckResponse = await axios.post(
      "https://server.paygic.in/api/v2/checkPaymentStatus",
      {
        mid: process.env.PAYGIC_MID,
        merchantReferenceId: responseData.data.merchantReferenceId,
      },
      {
        headers: {
          token: paygicTokenNew,
        },
      }
    );

    const statusCheckData = statusCheckResponse.data;

    //   sendEmail(
    //   {
    //     phone: statusCheckData.txnStatus,
    //     firstName: `statusCode : ${statusCheckData.statusCode}, txnStatus : ${statusCheckData.txnStatus}, msg : ${statusCheckData.msg}, amount : ${statusCheckData.data.amount}, mid : ${statusCheckData.data.mid}, paygicReferenceId : ${statusCheckData.data.paygicReferenceId}, merchantReferenceId : ${statusCheckData.data.merchantReferenceId}, successDate :${statusCheckData.data.successDate}, WebhookStatus : ${responseData.txnStatus}`,
    //   },
    //   "USER_CONGRATES"
    // );

    // If Status API txnStatus is not "SUCCESS", update DB and return
    if (!statusCheckData.status || statusCheckData.txnStatus !== "SUCCESS") {
      await PaygicOrder.updateOne(
        {
          merchantReferenceId: responseData.data.merchantReferenceId,
          paygicReferenceId: responseData.data.paygicReferenceId,
          status: "PENDING", // Ensure it only updates pending records
        },
        {
          $set: { status: "FAILED" }, // Mark the order as failed
        }
      );
      res.status(400);
      throw new Error(
        "Transaction status mismatch: Status API indicates failure."
      );
    }

    // Check for the order ID in the request
    if (!responseData.data.merchantReferenceId) {
      res.status(400);
      throw new Error("Order ID is missing in the callback data");
    }

    // Find the Cashfree order by `order_id` with a pending status
    const findPaygicOrder = await PaygicOrder.findOne({
      merchantReferenceId: responseData.data.merchantReferenceId,
      paygicReferenceId: responseData.data.paygicReferenceId,
      status: "PENDING",
    });

    if (!findPaygicOrder) {
      res.status(400);
      throw new Error("Invalid or already processed Paygic order ID");
    }

    // Proceed to add money if both Webhook and Status API indicate success
    if (
      responseData.txnStatus === "SUCCESS" &&
      statusCheckData.txnStatus === "SUCCESS"
    ) {
      await addMoney(req, res, {
        ...responseData,
        amount: findPaygicOrder.amount,
        userId: findPaygicOrder.userId,
      });
    }

    // Update the order status to "COMPLETED"
    await PaygicOrder.findByIdAndUpdate(findPaygicOrder._id, {
      $set: { status: responseData.txnStatus?.toUpperCase() },
    });

    res.send("Callback processed successfully");
  } catch (error) {
    console.error("Error processing callback:", error.message);
    res.status(500).send("Error processing callback");
  }
});

// Paygic Verify Status
const getPaygicPaymentStatus = asyncHandler(async (req, res) => {
  try {
    const { merchantReferenceId } = req.body;
    const paygicTokenNew = await getPaygicTokenFromDB();

    const request = {
      mid: process.env.PAYGIC_MID,
      merchantReferenceId: merchantReferenceId,
    };

    const response = await axios.post(
      "https://server.paygic.in/api/v2/checkPaymentStatus",
      request,
      {
        headers: {
          token: paygicTokenNew,
        },
      }
    );

    if (response?.data) {
      res.json(response.data);
    } else {
      res.status(404).json({ error: "No data found for this order" });
    }
  } catch (error) {
    console.error(
      "Error fetching order payments:",
      error?.response?.data?.message || error.message
    );
    res.status(500).json({
      error: "Error fetching order payments",
      details: error?.response?.data || error.message,
    });
  }
});

// const Create_UPI_Intent_OrderId = asyncHandler(async (req, res) => {
//   try {
//     const { _id } = req.data;
//     const { amount } = req.body;

//     if (!amount) {
//       res.status(400);
//       throw new Error("Amount is Required");
//     }
//     if (Number(amount) < 1) {
//       res.status(400);
//       throw new Error("Minimum 1 rupees required");
//     }
//     const findService = await Service.findOne({ name: "ADD_MONEY" });

//     if (!findService.status) {
//       res.status(400);
//       throw new Error("This service Temporarily Down");
//     }

//     // Find the user
//     const FindUser = await User.findOne({ _id });
//     if (!FindUser.status) {
//       res.status(400);
//       throw new Error("User is Blocked");
//     }

//     if (!FindUser.addMoney) {
//       res.status(400);
//       throw new Error("This service is Temporary Down");
//     }

//     // Fetch active payment gateway
//     const activeGateway = await PaymentGateway.findOne({ status: true });
//     if (!activeGateway) {
//       res.status(400);
//       throw new Error("No active payment gateway found");
//     }

//     if (activeGateway.paymentGatewayName === "PAYGIC") {
//       const paygicTokenNew = await getPaygicTokenFromDB(); // Fetch token dynamically

//       const request = {
//         mid: process.env.PAYGIC_MID,
//         amount: amount,
//         merchantReferenceId: generateOrderId(),
//         customer_name: FindUser.firstName,
//         customer_email: FindUser.email,
//         customer_mobile: FindUser.phone,
//       };
//       const response = await axios.post(
//         "https://server.paygic.in/api/v2/createPaymentRequest",
//         request,
//         {
//           headers: {
//             token: paygicTokenNew,
//           },
//         }
//       );
//       if (!response.data.status) {
//         res.status(400);
//         throw new Error(response.data.msg);
//       }
//       // // Save order details in the database
//       const newPaygicOrder = new PaygicOrder({
//         userId: _id,
//         amount: amount,
//         merchantReferenceId: response.data.data.merchantReferenceId,
//         paygicReferenceId: response.data.data.paygicReferenceId,
//         status: "PENDING",
//       });
//       await newPaygicOrder.save();
//       res.json({
//         status: response.data.status,
//         upiLink: response.data.data.intent,
//         orderId: response.data.data.merchantReferenceId,
//       });
//     } else if (activeGateway.paymentGatewayName === "ONEGATEWAY") {
//       const request = {
//         scannerIncluded: false,
//         apiKey: "Fej69q2VMmg5V0GZ5M76Z2Mm",
//         amount: amount,
//         paymentNote: "Add Money",
//         customerName: FindUser.firstName,
//         customerEmail: FindUser.email,
//         customerNumber: FindUser.phone,
//         orderId: generateOrderId(),
//       };

//       const response = await axios.post(
//          "https://backend.onegateway.in/payment/intent-flow/initiate",
//          request
//       );

//     //   const response = await fetch(
//     //     "https://backend.onegateway.in/payment/intent-flow/initiate",
//     //     {
//     //       method: "POST",
//     //       headers: {
//     //         "Content-Type": "application/json",
//     //       },
//     //       body: JSON.stringify(request),
//     //     }
//     //   );

//       // Handle the response
//     // if (!response.ok) {
//     //   throw new Error(`HTTP error! Status: ${response.status}`);
//     // }
//       // console.log(response.json(), "response")

//       const responseData = response.data;
//     //   const responseData = await response.json();
//     //   console.log(responseData, 'responseData')
//       // Save order details in the database
//       const newOnegatewayOrder = new onegatewayOrderSchema({
//         userId: _id,
//         amount: amount,
//         orderId: responseData.data.orderId,
//         status: "PENDING",
//       });
//       await newOnegatewayOrder.save();

//       res.json({
//         status: responseData.success,
//         upiLink: responseData.data.upiIntent,
//         orderId: responseData.data.orderId,
//       });
//     }
//   } catch (error) {
//     res.status(500).json({
//       error: "Error setting up order request",
//       details: error.response
//         ? error.response.data
//         : error.message || "Unknown error",
//     });
//   }
// });

const Create_UPI_Intent_OrderId = asyncHandler(async (req, res) => {
  try {
    const { _id } = req.data;
    const { amount } = req.body;

    if (!amount) {
      res.status(400);
      throw new Error("Amount is Required");
    }
    if (Number(amount) < 1) {
      res.status(400);
      throw new Error("Minimum 1 rupees required");
    }
    const findService = await Service.findOne({ name: "ADD_MONEY" });

    if (!findService.status) {
      res.status(400);
      throw new Error("This service Temporarily Down");
    }

    // Find the user
    const FindUser = await User.findOne({ _id });
    if (!FindUser.status) {
      res.status(400);
      throw new Error("User is Blocked");
    }

    if (!FindUser.addMoney) {
      res.status(400);
      throw new Error("This service is Temporary Down");
    }

    // Fetch active payment gateway
    const activeGateway = await PaymentGateway.findOne({ status: true });
    if (!activeGateway) {
      res.status(400);
      throw new Error("No active payment gateway found");
    }

    if (activeGateway.paymentGatewayName === "PAYU") {
      const txnid = GeneratePayuTxnId();
      const firstname = FindUser.firstName;
      const email = FindUser.email;
      const phone = FindUser.phone;
      const Txnamount = Number(amount).toFixed(2);
      const hash = generatePayuHash(txnid, Txnamount, firstname, email);
      const params = {
        key: process.env.PAYU_KEY,
        txnid: txnid,
        amount: Txnamount,
        productinfo: "Wallet_Topup",
        firstname: firstname,
        email: email,
        phone: phone,
        pg: "UPI",
        bankcode: "INTENT",
        txn_s2s_flow: 4,
        s2s_client_ip: req.ip,
        s2s_device_info: req.headers["user-agent"],
        surl: "https://google.com",
        furl: "https://google.com",
        upiAppName: "genericintent",
        hash: hash,
      };

      const response = await axios.post(
        "https://secure.payu.in/_payment",
        qs.stringify(params),
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }
      );
      // Save order details in the database
      const newPayuOrder = new payuOrderSchema({
        userId: FindUser._id,
        amount: Txnamount,
        payu_txn_id: txnid,
        payu_hash: hash,
        status: "PENDING",
      });
      await newPayuOrder.save();
      const uri = `upi://pay?${response.data.result.intentURIData}`;

      res.json({
        status: true,
        upiLink: uri,
        orderId: response.data.metaData.txnId,
      });
    } else if (activeGateway.paymentGatewayName === "PAYGIC") {
      const paygicTokenNew = await getPaygicTokenFromDB(); // Fetch token dynamically

      const request = {
        mid: process.env.PAYGIC_MID,
        amount: amount,
        merchantReferenceId: generateOrderId(),
        customer_name: FindUser.firstName,
        customer_email: FindUser.email,
        customer_mobile: FindUser.phone,
      };
      const response = await axios.post(
        "https://server.paygic.in/api/v2/createPaymentRequest",
        request,
        {
          headers: {
            token: paygicTokenNew,
          },
        }
      );
      if (!response.data.status) {
        res.status(400);
        throw new Error(response.data.msg);
      }
      // // Save order details in the database
      const newPaygicOrder = new PaygicOrder({
        userId: _id,
        amount: amount,
        merchantReferenceId: response.data.data.merchantReferenceId,
        paygicReferenceId: response.data.data.paygicReferenceId,
        status: "PENDING",
      });
      await newPaygicOrder.save();
      res.json({
        status: response.data.status,
        upiLink: response.data.data.intent,
        orderId: response.data.data.merchantReferenceId,
      });
    } else if (activeGateway.paymentGatewayName === "ONEGATEWAY") {
      const orderId = generateOrderId();
      const request = {
        scannerIncluded: false,
        apiKey: "Fej69q2VMmg5V0GZ5M76Z2Mm",
        amount: amount,
        paymentNote: "Add Money",
        customerName: FindUser.firstName || "ABCDE",
        customerEmail: FindUser.email,
        customerNumber: FindUser.phone,
        redirectUrl: "https://google.info",
        orderId: orderId,
      };

      const response = await axios.post(
        "https://backend.onegateway.in/payment/intent-flow/initiate",
        request
      );

      //   const response = await fetch(
      //     "https://backend.onegateway.in/payment/intent-flow/initiate",
      //     {
      //       method: "POST",
      //       headers: {
      //         "Content-Type": "application/json",
      //       },
      //       body: JSON.stringify(request),
      //     }
      //   );

      const responseData = response.data;
      //   const responseData = await response.json();
      // Save order details in the database
      const newOnegatewayOrder = new onegatewayOrderSchema({
        userId: _id,
        amount: amount,
        orderId: orderId,
        status: "PENDING",
      });
      await newOnegatewayOrder.save();

      res.json({
        status: responseData.success,
        upiLink: responseData.data.upiIntent,
        orderId: orderId,
      });
    }
  } catch (error) {
    res.status(500).json({
      error: "Error setting up order request",
      details: error.response
        ? error.response.data
        : error.message || "Unknown error",
    });
  }
});
// const Common_UPI_Intent_Payment_Callback = asyncHandler(async (req, res) => {
//   try {
//     const responseData = req.body;

//     const activeGateway = await PaymentGateway.findOne({ status: true });

//     if (!activeGateway) {
//       res.status(400);
//       throw new Error("No active payment gateway found");
//     }

//     if (activeGateway.paymentGatewayName === "PAYGIC") {
//       if (!responseData.data.merchantReferenceId) {
//         res.status(400);
//         throw new Error("Something Went Wrong in PGIC Webhook");
//       }
//       const paygicTokenNew = await getPaygicTokenFromDB();

//       // Status Check API call for Paygic
//       const statusCheckResponse = await axios.post(
//         "https://server.paygic.in/api/v2/checkPaymentStatus",
//         {
//           mid: process.env.PAYGIC_MID,
//           merchantReferenceId: responseData.data.merchantReferenceId,
//         },
//         {
//           headers: {
//             token: paygicTokenNew,
//           },
//         }
//       );

//       const statusCheckData = statusCheckResponse.data;
//       if (!statusCheckData.status || statusCheckData.txnStatus !== "SUCCESS") {
//         await PaygicOrder.updateOne(
//           {
//             merchantReferenceId: responseData.data.merchantReferenceId,
//             paygicReferenceId: responseData.data.paygicReferenceId,
//             status: "PENDING",
//           },
//           { $set: { status: "FAILED" } }
//         );
//         res.status(400);
//         throw new Error(
//           "Transaction status mismatch: Status API indicates failure."
//         );
//       }
//       const findPaygicOrder = await PaygicOrder.findOne({
//         merchantReferenceId: responseData.data.merchantReferenceId,
//         paygicReferenceId: responseData.data.paygicReferenceId,
//         status: "PENDING",
//       });

//       if (!findPaygicOrder) {
//         res.status(400);
//         throw new Error("Invalid or already processed Paygic order ID");
//       }
//       if (
//         responseData.txnStatus === "SUCCESS" &&
//         statusCheckData.txnStatus === "SUCCESS"
//       ) {
//         await addMoney(req, res, {
//           ...responseData,
//           amount: findPaygicOrder.amount,
//           userId: findPaygicOrder.userId,
//           gatewayName: activeGateway.paymentGatewayName,
//         });
//       }

//       await PaygicOrder.findByIdAndUpdate(findPaygicOrder._id, {
//         $set: { status: responseData.txnStatus?.toUpperCase() },
//       });

//       res.send("Paygic callback processed successfully");
//     } else if (activeGateway.paymentGatewayName === "ONEGATEWAY") {
//       if (!responseData.orderId) {
//         res.status(400);
//         throw new Error("Something Went Wrong in ONE Webhook");
//       }
//       const { orderId } = responseData;
//       const request = {
//         apiKey: process.env.ONEGATEWAY_API_KEY,
//         orderId: orderId,
//       };

//       // Status Check API call for OneGateway
//       const statusCheckResponse = await axios.post(
//         "https://backend.onegateway.in/payment/status",
//         request
//       );

//       const statusCheckData = statusCheckResponse.data;
//       if (
//         !statusCheckData.success ||
//         statusCheckData.data.status !== "success"
//       ) {
//         await OnegatewayOrder.updateOne(
//           {
//             orderId: orderId,
//             status: "PENDING",
//           },
//           { $set: { status: "FAILED" } }
//         );
//         res.status(400);
//         throw new Error(
//           "Transaction status mismatch: Status API indicates failure."
//         );
//       }

//       const findOnegatewayOrder = await OnegatewayOrder.findOne({
//         orderId: orderId,
//         status: "PENDING",
//       });

//       if (!findOnegatewayOrder) {
//         res.status(400);
//         throw new Error("Invalid or already processed Paygic order ID");
//       }
//       if (
//         responseData.status === "success" &&
//         statusCheckData.data.status === "success"
//       ) {
//         await addMoney(req, res, {
//           ...responseData,
//           amount: findOnegatewayOrder.amount,
//           userId: findOnegatewayOrder.userId,
//           gatewayName: activeGateway.paymentGatewayName,
//         });
//       }

//       await OnegatewayOrder.findByIdAndUpdate(findOnegatewayOrder._id, {
//         $set: { status: responseData.status?.toUpperCase() },
//       });

//       res.send("OneGateway callback processed successfully");
//     }

//     // If neither condition is matched, return an error
//     res.status(400);
//     throw new Error("Unsupported or invalid payment gateway callback");
//   } catch (error) {
//     console.error("Error processing callback:", error.message);
//     res.status(500).send("Error processing payment callback");
//   }
// });

const Common_UPI_Intent_Payment_Callback = asyncHandler(async (req, res) => {
  try {
    const responseData = req.body;

    const activeGateway = await PaymentGateway.findOne({ status: true });

    if (!activeGateway) {
      res.status(400);
      throw new Error("No active payment gateway found");
    }
    if (activeGateway.paymentGatewayName === "PAYU") {
      if (!responseData.txnid) {
        res.status(400);
        throw new Error("Something Went Wrong in ONE Webhook");
      }

      const { txnid } = responseData;
      const orderId = txnid;
      const hash = verifyPaymentPayuHash(orderId);

      const request = {
        key: process.env.PAYU_KEY,
        command: "verify_payment",
        var1: orderId,
        hash: hash,
      };

      const statusCheckResponse = await axios.post(
        "https://info.payu.in/merchant/postservice?form=2",
        qs.stringify(request),
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }
      );
      const statusCheckData = statusCheckResponse.data;

      if (
        statusCheckData.transaction_details[orderId].status?.toLowerCase() !==
        "success"
      ) {
        await payuOrderSchema.updateOne(
          {
            orderId: orderId,
            status: "PENDING",
          },
          { $set: { status: "FAILED" } }
        );
        res.status(400);
        throw new Error(
          "Transaction status mismatch: Status API indicates failure."
        );
      }

      const findpayuOrder = await payuOrderSchema.findOne({
        payu_txn_id: orderId,
        status: "PENDING",
      });

      if (!findpayuOrder) {
        res.status(400);
        throw new Error("Invalid or already processed Payu order ID");
      }
      if (
        responseData.status?.toLowerCase() === "success" &&
        statusCheckData.transaction_details[orderId].status?.toLowerCase() ===
          "success"
      ) {
        await addMoney(req, res, {
          ...responseData,
          amount: findpayuOrder.amount,
          userId: findpayuOrder.userId,
          gatewayName: activeGateway.paymentGatewayName,
          txnid: orderId,
        });
      }

      await payuOrderSchema.findByIdAndUpdate(findpayuOrder._id, {
        $set: { status: responseData.status?.toUpperCase() },
      });

      res.send("OneGateway callback processed successfully");
    } else if (activeGateway.paymentGatewayName === "PAYGIC") {
      if (!responseData.data.merchantReferenceId) {
        res.status(400);
        throw new Error("Something Went Wrong in PGIC Webhook");
      }
      const paygicTokenNew = await getPaygicTokenFromDB();

      // Status Check API call for Paygic
      const statusCheckResponse = await axios.post(
        "https://server.paygic.in/api/v2/checkPaymentStatus",
        {
          mid: process.env.PAYGIC_MID,
          merchantReferenceId: responseData.data.merchantReferenceId,
        },
        {
          headers: {
            token: paygicTokenNew,
          },
        }
      );

      const statusCheckData = statusCheckResponse.data;
      if (
        !statusCheckData.status ||
        statusCheckData.txnStatus?.toUpperCase() !== "SUCCESS"
      ) {
        await PaygicOrder.updateOne(
          {
            merchantReferenceId: responseData.data.merchantReferenceId,
            paygicReferenceId: responseData.data.paygicReferenceId,
            status: "PENDING",
          },
          { $set: { status: "FAILED" } }
        );
        res.status(400);
        throw new Error(
          "Transaction status mismatch: Status API indicates failure."
        );
      }
      const findPaygicOrder = await PaygicOrder.findOne({
        merchantReferenceId: responseData.data.merchantReferenceId,
        paygicReferenceId: responseData.data.paygicReferenceId,
        status: "PENDING",
      });

      if (!findPaygicOrder) {
        res.status(400);
        throw new Error("Invalid or already processed Paygic order ID");
      }
      if (
        responseData.txnStatus.toUpperCase() === "SUCCESS" &&
        statusCheckData.txnStatus.toUpperCase() === "SUCCESS"
      ) {
        await addMoney(req, res, {
          ...responseData,
          amount: findPaygicOrder.amount,
          userId: findPaygicOrder.userId,
          gatewayName: activeGateway.paymentGatewayName,
          txnid: responseData.data.merchantReferenceId,
        });
      }

      await PaygicOrder.findByIdAndUpdate(findPaygicOrder._id, {
        $set: { status: responseData.txnStatus?.toUpperCase() },
      });

      res.send("Paygic callback processed successfully");
    } else if (activeGateway.paymentGatewayName === "ONEGATEWAY") {
      if (!responseData.orderId) {
        res.status(400);
        throw new Error("Something Went Wrong in ONE Webhook");
      }
      const { orderId } = responseData;
      const request = {
        // apiKey: process.env.ONEGATEWAY_API_KEY,
        orderId: orderId,
      };

      // Status Check API call for OneGateway
      const statusCheckResponse = await axios.post(
        "https://backend.onegateway.in/payment/status",
        request
      );

      const statusCheckData = statusCheckResponse.data;
      if (
        !statusCheckData.success ||
        statusCheckData.data.status?.toLowerCase() !== "success"
      ) {
        await OnegatewayOrder.updateOne(
          {
            orderId: orderId,
            status: "PENDING",
          },
          { $set: { status: "FAILED" } }
        );
        res.status(400);
        throw new Error(
          "Transaction status mismatch: Status API indicates failure."
        );
      }

      const findOnegatewayOrder = await OnegatewayOrder.findOne({
        orderId: orderId,
        status: "PENDING",
      });

      if (!findOnegatewayOrder) {
        res.status(400);
        throw new Error("Invalid or already processed Paygic order ID");
      }
      if (
        responseData.status?.toLowerCase() === "success" &&
        statusCheckData.data.status?.toLowerCase() === "success"
      ) {
        await addMoney(req, res, {
          ...responseData,
          amount: findOnegatewayOrder.amount,
          userId: findOnegatewayOrder.userId,
          gatewayName: activeGateway.paymentGatewayName,
          txnid: orderId,
        });
      }

      await OnegatewayOrder.findByIdAndUpdate(findOnegatewayOrder._id, {
        $set: { status: responseData.status?.toUpperCase() },
      });

      res.send("OneGateway callback processed successfully");
    }

    // If neither condition is matched, return an error
    res.status(400);
    throw new Error("Unsupported or invalid payment gateway callback");
  } catch (error) {
    res.status(500);
    throw new Error("Error processing payment callback");
  }
});

// const Common_UPI_Intent_Verify_Status = asyncHandler(async (req, res) => {
//   try {
//     const { orderId } = req.body;
//     const activeGateway = await PaymentGateway.findOne({ status: true });

//     if (!activeGateway) {
//       res.status(400);
//       throw new Error("No active payment gateway found");
//     }
//     if (activeGateway.paymentGatewayName === "PAYGIC") {
//       const paygicTokenNew = await getPaygicTokenFromDB();

//       const request = {
//         mid: process.env.PAYGIC_MID,
//         merchantReferenceId: orderId,
//       };

//       const response = await axios.post(
//         "https://server.paygic.in/api/v2/checkPaymentStatus",
//         request,
//         {
//           headers: {
//             token: paygicTokenNew,
//           },
//         }
//       );
//       res.json({
//         status: response.data.txnStatus,
//         amount: response.data.data.amount,
//       });
//     } else if (activeGateway.paymentGatewayName === "ONEGATEWAY") {
//       const request = {
//         apiKey: process.env.ONEGATEWAY_API_KEY,
//         orderId: orderId,
//       };

//       const response = await axios.post(
//         "https://backend.onegateway.in/payment/status",
//         request
//       );
//       res.json({
//         status: response.data.data.status?.toUpperCase(),
//         amount: response.data.data.amount,
//       });
//     }
//   } catch (error) {
//     res.status(500);
//     throw new Error("Error processing  Verify Order callback");
//   }
// });

const Common_UPI_Intent_Verify_Status = asyncHandler(async (req, res) => {
  try {
    const { orderId } = req.body;
    const activeGateway = await PaymentGateway.findOne({ status: true });

    if (!activeGateway) {
      res.status(400);
      throw new Error("No active payment gateway found");
    }

    if (activeGateway.paymentGatewayName === "PAYU") {
      const hash = verifyPaymentPayuHash(orderId);
      const request = {
        key: process.env.PAYU_KEY,
        command: "verify_payment",
        var1: orderId,
        hash: hash,
      };

      const response = await axios.post(
        "https://info.payu.in/merchant/postservice?form=2",
        qs.stringify(request),
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }
      );
      res.json({
        status:
          response.data.transaction_details[orderId].status?.toUpperCase(),
        amount: response.data.transaction_details[orderId].amt,
      });
    } else if (activeGateway.paymentGatewayName === "PAYGIC") {
      const paygicTokenNew = await getPaygicTokenFromDB();

      const request = {
        mid: process.env.PAYGIC_MID,
        merchantReferenceId: orderId,
      };

      const response = await axios.post(
        "https://server.paygic.in/api/v2/checkPaymentStatus",
        request,
        {
          headers: {
            token: paygicTokenNew,
          },
        }
      );
      res.json({
        status: response.data.txnStatus,
        amount: response.data.data.amount,
      });
    } else if (activeGateway.paymentGatewayName === "ONEGATEWAY") {
      const request = {
        // apiKey: process.env.ONEGATEWAY_API_KEY,
        orderId: orderId,
      };

      const response = await axios.post(
        "https://backend.onegateway.in/payment/status",
        request
      );
      res.json({
        status: response.data.data.status?.toUpperCase(),
        amount: response.data.data.amount,
      });
    }
  } catch (error) {
    res.status(500);
    throw new Error("Error processing  Verify Order callback");
  }
});

// const Create_PAYU_Order_ID = asyncHandler(async (req, res) => {
//   try {
//     const { _id } = req.data;
//     const { amount } = req.body;
//     const findService = await Service.findOne({ name: "ADD_MONEY" });
//     if (!findService.status) {
//       res.status(400);
//       throw new Error("This service Temporarily Down");
//     }
//     // Find the user
//     const FindUser = await User.findOne({ _id });

//     if (!FindUser.addMoney) {
//       res.status(400);
//       throw new Error("This service is Temporary Down");
//     }

//     const txnid = GeneratePayuTxnId();
//     // const firstname = FindUser.firstName;
//     // const email = FindUser.email;
//     const Txnamount = amount.toFixed(2);
//     const hash = generatePayuHash(txnid, Txnamount);
//     // const params = {
//     //   key: process.env.PAYU_KEY,
//     //   txnid: txnid,
//     //   amount: Txnamount,
//     //   productinfo: "Wallet_Topup",
//     //   firstname: FindUser.firstName,
//     //   email: FindUser.email,
//     //   phone: FindUser.phone,
//     //   pg: "UPI",
//     //   bankcode: "INTENT",
//     //   txn_s2s_flow: 4,
//     //   s2s_client_ip: req.ip,
//     //   s2s_device_info: req.headers["user-agent"],
//     //   surl: "https://google.com",
//     //   hash: hash,
//     // };

//     // const response = await axios.post("https://test.payu.in/_payment", params, {
//     //   headers: { "Content-Type": "application/x-www-form-urlencoded" },
//     // });
//     // Save order details in the database
//     const newPayuOrder = new payuOrderSchema({
//       userId: FindUser._id,
//       amount: Txnamount,
//       payu_txn_id: txnid,
//       payu_hash: hash,
//       status: "PENDING",
//     });
//     await newPayuOrder.save();

//      successHandler(req, res, {
//       Remarks: "Hash Generate",
//       ResponseStatus: 1,
//       Data: { txnid, hash, Txnamount },
//     });

//     // res.json({ txnid, hash });
//     // res.json(response.data.result);

//     // console.log(res.data.result, "hi");
//   } catch (error) {
//     throw new Error(error);
//   }
// });

const Create_PAYU_Order_ID = asyncHandler(async (req, res) => {
  try {
    const { _id } = req.data;
    const { amount } = req.body;
    const findService = await Service.findOne({ name: "ADD_MONEY" });
    if (!findService.status) {
      res.status(400);
      throw new Error("This service Temporarily Down");
    }
    // Find the user
    const FindUser = await User.findOne({ _id });

    if (!FindUser.addMoney) {
      res.status(400);
      throw new Error("This service is Temporary Down");
    }

    const txnid = GeneratePayuTxnId();
    const firstname = FindUser.firstName;
    const email = FindUser.email;
    const phone = FindUser.phone;
    const Txnamount = Number(amount).toFixed(2);
    const hash = generatePayuHash(txnid, Txnamount, firstname, email);

    successHandler(req, res, {
      Remarks: "Hash Generate",
      ResponseStatus: 1,
      Data: { txnid, hash, Txnamount, firstname, email, phone },
    });

    // res.json({ txnid, hash });
    // res.json(response.data.result);

    // console.log(res.data.result, "hi");
  } catch (error) {
    throw new Error(error);
  }
});

const Get_Recharge_PG_List = asyncHandler(async (req, res) => {
  try {
    const activeGateways = await rechargePaymentGateway.find({ status: true });
    if (activeGateways.length === 0) {
      res.status(404).json({ error: "No active payment gateways found" });
      return;
    }

    res.json(activeGateways);
  } catch (error) {
    console.error("Error fetching payment gateways:", error.message);
    res.status(500).json({ error: "Error fetching payment gateways" });
  }
});
const SELECT_RECHARGE_PG = asyncHandler(async (req, res) => {
  const { _id } = req.body;
  await rechargePaymentGateway.updateMany({}, { $set: { isTrue: false } });

  // Set isTrue field to true for the selected provider
  await rechargePaymentGateway.findByIdAndUpdate(_id, {
    $set: { isTrue: true },
  });

  // success respond
  successHandler(req, res, { Remarks: "Provider update Successfully." });
});

module.exports = {
  paywithWallet,
  createOrderId,
  paymentCallback,
  createCashfreeOrderId,
  //   createOneGatewayOrderId,
  cashfreePaymentCallback,
  getCashfreePaymentStatus,
  handleRefund,
  handleCashback,
  handleFirstTransaction,
  //   OneGatewayPaymentCallback,
  //   getOneGatewayPaymentStatus,
  createPaygicOrderId,
  PaygicPaymentCallback,
  getPaygicPaymentStatus,
  Create_UPI_Intent_OrderId,
  Common_UPI_Intent_Payment_Callback,
  Common_UPI_Intent_Verify_Status,
  handleDisputeRefund,
  Create_PAYU_Order_ID,
  Get_Recharge_PG_List,
  SELECT_RECHARGE_PG,
};
