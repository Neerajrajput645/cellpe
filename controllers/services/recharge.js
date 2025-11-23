const asyncHandler = require("express-async-handler");
const axios = require("axios");
// const express = require("express");
const fs = require("fs");
const path = require("path");
const moment = require("moment");
const User = require("../../models/userSchema");
const BBPS = require("../../models/service/bbps");
const Wallet = require("../../models/walletSchema");
const DTH = require("../../models/service/dthSchema");
const Service = require("../../models/serviceSchema");
const successHandler = require("../../common/successHandler");
const Recharge = require("../../models/service/rechargeSchema");
const Notification = require("../../models/notificationSchema");
const sendNotification = require("../../common/sendNotification");
const getIpAddress = require("../../common/getIpAddress");
const Commission = require("../../models/newModels/commission");
const Transaction = require("../../models/txnSchema");
const CryptoJS = require("crypto-js");
const rechargeApiProviderSchema = require("../../models/service/rechargeApiProviderSchema");
const {
  All_Recharge_Operator_List,
  All_Recharge_Circle_List,
  All_DTH_Recharge_Operator_List,
} = require("../../utils/MockData");
const {
  paywithWallet,
  handleRefund,
  handleCashback,
  handleDisputeRefund,
} = require("../payment");
const { generateOrderId } = require("../../common/generateOrderId");
const CRYPTO_SECRET = process.env.CRYPTO_SECRET;
// const nodemailer = require("nodemailer");
const Users = require("../../models/userSchema");
const planFetchProviderSchema = require("../../models/service/planFetchProviderSchema");
const RechargeOperator = require("../../models/service/rechargeOperatorSchema");
// const rechargeOperatorSchema = require("../../models/service/rechargeOperatorSchema");
const { saveLog } = require("../../common/logger");
const {
  // MobikwikCheckSumGenerate,
  parseXMLToJSON,
} = require("../../common/PayuHashGenerate");
const mobileTypeCheck = require("../../mobileTypeCheck.json");
const crypto = require("crypto");

const genTxnId = () => {
  // Generate an 8-digit unique ID
  const randomPart = crypto.randomBytes(4).toString("hex"); // 8 hex characters
  return "TXNPP" + randomPart.slice(0, 8).toUpperCase(); // TXN + 8 = 16 total
};


// credentials
// const CYRUS_MEMBER_ID = process.env.CYRUS_MEMBER_ID;
// const CYRUS_PAYMENT_KEY = process.env.CYRUS_PAYMENT_KEY;
// const CYRUS_RECHARGE_KEY = process.env.CYRUS_RECHARGE_KEY;

// EMAIL
// const service_email = process.env.COMPANY_EMAIL;
// const service_email_password = process.env.COMPANY_EMAIL_PASSWORD;


const planFetch = asyncHandler(async (req, res) => {

  const { Operator_Code, Circle_Code, MobileNumber } = req.query;
console.log(req.query, "plan fetch req.query");
  const selectedOperator = await planFetchProviderSchema.findOne({
    isTrue: true,
  });
  console.log(selectedOperator, "selectedOperator");

  if (selectedOperator.providerCode === 1) {
    const findOp = All_Recharge_Operator_List.find(
      (a) => a.PlanApi_Operator_code == Operator_Code
    );
    const findCir = All_Recharge_Circle_List.find(
      (a) => a.planapi_circlecode == Circle_Code
    );
    const plans = await axios.get(
      `https://alpha3.mobikwik.com/recharge/plans/v2/rechargePlansAPI/${findOp.Mobikwik_Operator_code}/${findCir.Mobikwik_circlecode}`,
      {
        headers: {
          "X-Mclient": "14",
        },
      }
    );

    // if error
    if (!plans.data.success) {
      res.status(400);
      throw new Error("Errors in Plan Fetching");
    }

    // const Plans = await plans.data.

    // success respond
    successHandler(req, res, {
      Remarks: "All plans",
      Data: plans?.data.data.plans,
    });
  } else if (selectedOperator.providerCode === 2) {
    const findOp = All_Recharge_Operator_List.find(
      (a) => a.PlanApi_Operator_code == Operator_Code
    );
    // console.log(findOp, "findOp");
    const findCir = All_Recharge_Circle_List.find(
      (a) => a.planapi_circlecode == Circle_Code
    );
    // console.log(findOp, "findCir");

    const plans = await axios.get(
      `http://planapi.in/api/Mobile/Operatorplan?apimember_id=${process.env.PLAN_API_USER_ID}&api_password=${process.env.PLAN_API_PASSWORD}&cricle=${findCir.planapi_circlecode}&operatorcode=${findOp.PlanApi_Operator_code}`
    );
    // console.log(plans.data, "plans");
    // if error
    if (plans.data.STATUS != 0) {
      res.status(400);
      throw new Error("Errors in Plan Fetching");
    }

    const flattenRDATA = (data) => {
      let result = [];
      for (let key in data) {
        if (Array.isArray(data[key])) {
          result = result.concat(data[key]);
        }
      }
      return result;
    };

    const flattenedArray = flattenRDATA(plans?.data.RDATA);

    if (["Airtel", "VI"].includes(findOp.Operator_name)) {
      // Fetch ROFFER data
      const rofferResponse = await axios.get(
        `http://planapi.in/api/Mobile/RofferCheck?apimember_id=${process.env.PLAN_API_USER_ID}&api_password=${process.env.PLAN_API_PASSWORD}&operator_code=${findOp.PlanApi_Operator_code}&mobile_no=${MobileNumber}`
      );

      // console.log(rofferResponse.data, "rofferResponse");

      const rofferData = rofferResponse.data.RDATA.map((roffer) => ({
        Type: "roffer",
        rs: parseInt(roffer.price, 10), // Ensure price is numeric
        validity: "N/A",
        desc: `${roffer.logdesc} | ${roffer.ofrtext}`,
      }));

      // Create a map for ROFFER data based on 'rs' (price)
      const rofferMap = new Map(
        rofferData.map((roffer) => [roffer.rs, roffer])
      );

      // Replace overlapping plans and combine unique ROFFER plans
      const mergedPlans = flattenedArray.map((plan) =>
        rofferMap.has(plan.rs) ? rofferMap.get(plan.rs) : plan
      );

      rofferData.forEach((roffer) => {
        if (!mergedPlans.some((plan) => plan.rs === roffer.rs)) {
          mergedPlans.push(roffer); // Add unique ROFFER plans
        }
      });

      // success respond
      successHandler(req, res, {
        Remarks: "All plans",
        image: findOp.img,
        Data: (mergedPlans),
      });
    } else {
      successHandler(req, res, {
        Remarks: "All plans",
        image: findOp.img,
        Data: (flattenedArray),

      });
    }
  }
});

const BillhubComplainRaise = asyncHandler(async (req, res) => {
  try {
    const { order_id, message } = req.query;
    const response = await axios.get(
      `https://api.techember.in/app/complaints/main.php?token=${process.env.BILLHUB_TOKEN}&order_id=${order_id}&message=${message}`
    );
    console.log(response, "Billhub Complain Response");
    // success respond
    successHandler(req, res, {
      Remarks: "Complained Raised",
      Data: response?.data,
    });
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

const rechargeRequest = asyncHandler(async (req, res) => {
  try {
    //throw new Error("Recharge API is currently disabled for maintenance.");
    const { _id, deviceToken } = req.data;
    const ipAddress = getIpAddress(req);
    const { number, amount, mPin, operator, circle } = req.query;
    const isPrepaid = Boolean(req.query.isPrepaid);
    const TxnAmount = Number(amount);

    const [findService, FindUser, walletFound] = await Promise.all([
      Service.findOne({ name: "Recharge" }),
      Users.findOne({ _id }),
      Wallet.findOne({ userId: _id }),
    ]);

    if (!findService?.status) {
      res.status(400);

      console.log("step-1", findService)
      throw new Error("Recharge Failed, Please Try Again Ex100");
    }

    if (!FindUser.status) {
      res.status(400);
      throw new Error("User is Blocked");
    }

    if (!FindUser?.recharge) {
      res.status(400);
      throw new Error("Recharge Failed, Please Try Again Ex150");
    }

    if (TxnAmount <= 0) {
      res.status(400);
      throw new Error("Amount should be positive.");
    }

    if (!req.data.mPin) {
      res.status(400);
      throw new Error("Please set an mPin.");
    }

    // Decrypt mPin
    const decryptMpin = CryptoJS.AES.decrypt(
      req.data.mPin,
      CRYPTO_SECRET
    ).toString(CryptoJS.enc.Utf8);

    if (mPin.toString() !== decryptMpin) {
      res.status(400);
      throw new Error("Please enter a valid mPin.");
    }
    if (walletFound.balance < TxnAmount) {
      console.log("wallet", walletFound)
      res.status(400);
      throw new Error("User wallet balance is low.");
    }

    // Fetch OPerator & Circle

    const findOperator = All_Recharge_Operator_List.find(
      (a) => a.PlanApi_Operator_code == operator
    );

    const findCircle = All_Recharge_Circle_List.find(
      (a) => a.planapi_circlecode == circle
    );

    if (
      !findCircle?.planapi_circlecode ||
      !findOperator?.PlanApi_Operator_code
    ) {
      res.status(400);
      throw new Error("Invalid Operator or Circle.");
    }

    const transactionId = generateOrderId();


    const body = {
      orderId: transactionId,
      txnAmount: TxnAmount,
      txnId: transactionId,
      serviceId: findService._id,
      mPin,
      userId: FindUser._id,
      ipAddress,
    };

    const res1 = await paywithWallet({ body });

    if (res1.ResponseStatus == 1) {
      const selectedOperator = await rechargeApiProviderSchema.findOne({
        isTrue: true,
      });
      function capitalize(word) {
        if (!word) return ""; // अगर स्ट्रिंग खाली हो
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }
      if (selectedOperator.providerCode === 2) {
        // Billhub

        const newRecharge = new Recharge({
          userId: FindUser._id,
          number,
          operator: findOperator.PlanApi_Operator_code,
          circle: findCircle.planapi_circlecode,
          amount: TxnAmount,
          transactionId,
          status: "pending",
          operatorRef: 0,
          apiTransID: transactionId,
          ipAddress,
          provider: "Billhub",
          isPrepaid,
        });
        await newRecharge.save();


        try {
          const bodyData = {
            token: process.env.BILLHUB_TOKEN,
            number: number,
            op_uid: findOperator.Billhub_Operator_code,
            amount: TxnAmount,
            order_id: transactionId,
            type: isPrepaid ? "prepaid" : "postpaid",
            circle: findCircle.planapi_circlecode,
          }
          let response;
          // console.log(bodyData, "bodyData");
          let rechargeRe;


          try {
            // console.log("Calling Recharge API");

            //      rechargeRe = await axios.post("https://api.techember.in/app/recharges/main.php", bodyData);
            rechargeRe = {
              data: {
                status: 'success',
                order_id: '1869354044',
                margin: '0.1950',
                margin_percentage: '1.9500',
                operator_ref_id: '1878093437'
              }
            }
            // throw new Error("Test Error");
            response = rechargeRe.data;
            // console.log("wer")
          } catch (error) {
            if (error.response) {
              response = error.response.data;
              // console.log("Error Response from Recharge API:", response);
            }
          }

          await saveLog(
            "MOBILE_RECHARGE",
            "https://api.techember.in/app/recharges/main.php",
            bodyData,
            response,
            `Recharge response received for TxnID: ${transactionId}, Status:` + (response ? response?.status : 'No Response')
          );

          if (!response) {
            successHandler(req, res, {
              Remarks: `Your Recharge is Pending`,
              Data: ({
                status: "PENDING",
                operator_ref_id: response?.operator_ref_id || 0,
              }),
            });
          }

          newRecharge.rawResponse = response;
          await newRecharge.save();
          newRecharge.status = response?.status?.toLowerCase();
          newRecharge.operatorRef = response?.operator_ref_id || 0;
          await newRecharge.save();
          const status = response?.status?.toLowerCase();
          if (status == "failed") {
            // Start Refund-------------------------------------------------
            await handleRefund(
              FindUser,
              TxnAmount,
              transactionId,
              ipAddress,
              walletFound
            );
            // End Refund ------------------------------------------------------------------
            res.status(400);
            throw new Error(response.message || "Recharge Failed, Please Try Again");
          }

          // Start Cashback--------------------------
          if (status == "success" && isPrepaid) {
            console.log("Processing Cashback", findService._id);
            // const findRechargeOperator = await RechargeOperator.findOne({
            //   serviceId: findService._id,
            // });

            const op = findOperator.com_name;
            // console.log("Found Operator Name:", findOperator);
            console.log("Operator for Cashback:", op);
            const commission = await Commission.findOne({  name : op, status:true });
            console.log("Commission Details:", commission);
            const findPercent = commission ? commission?.commission : 0;
            console.log("Cashback Percent:", findPercent);
            const cashbackPercent = (TxnAmount / 100) * findPercent;
            console.log("Calculated Cashback Amount:", cashbackPercent);
            // if (!findRechargeOperator) {
            //   throw new Error("Recharge operator or operator data not found.");
            // }
            // let findPercent;
            // const operatorMapping = {
            //   airtel: findRechargeOperator.airtel,
            //   jio: findRechargeOperator.jio,
            //   vi: findRechargeOperator.vi,
            //   bsnl_topup: findRechargeOperator.bsnl,
            // };

            // findPercent =
            //   operatorMapping[findOperator.Billhub_Operator_code] || 0; // Default 0 if not found
            // const cashbackPercent = (TxnAmount / 100) * findPercent;


            await handleCashback(
              FindUser,
              cashbackPercent,
              transactionId,
              ipAddress,
              walletFound
            );
          }
          // End Cashback ---------------------------


          const notification = {
            title: `Recharge ${status}`,
            body: `Your ₹${TxnAmount} recharge is ${status}`,
          };

          const newNotification = new Notification({
            ...notification,
            recipient: _id,
          });

          await newNotification.save();
          if (deviceToken) {
            sendNotification(notification, deviceToken);
          }

          // Success response
          successHandler(req, res, {
            Remarks: `Your Recharge is ${status}`,
            Data: ({
              status: capitalize(status),
              // number:newRecharge.number,
              transactionId: newRecharge.transactionId,
              // transectionId:newRecharge.txnId,
              operator_ref_id: response?.operator_ref_id || 0,
            }),
          });
        } catch (error) {
          if (error.code === "ECONNABORTED") {
            // Timeout Error Handling
            newRecharge.status = "pending";
            newRecharge.rawResponse = "Request timed out";
            await newRecharge.save();

            await saveLog(
              "MOBILE_RECHARGE",
              null,
              null, // or full request payload
              error?.response?.data || error.message,
              `Request timed out for TxnID: ${transactionId}`
            );

            successHandler(req, res, {
              Remarks: `Your Recharge is Pending`,
              Data: ({ status: "PENDING" }),
            });
          } else {
            // Other Errors
            newRecharge.status = "pending";
            newRecharge.rawResponse = error.message;
            await newRecharge.save();
            await saveLog(
              "MOBILE_RECHARGE",
              null,
              null, // or full request payload
              error?.response?.data || error.message,
              `Error during recharge for TxnID: ${transactionId}`
            );
            res.status(400);
            throw new Error(error.message);
          }

          // newRecharge.status = "error";
          // newRecharge.rawResponse = error.message;
          // await newRecharge.save();

          // res.status(400);
          // throw new Error(error.message);
        }
      }

    } else {
      res.status(400);
      throw new Error("Payment Failed, Please Contact to Customer Care");
    }
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

//recharge status
const rechargeStatus = asyncHandler(async (req, res) => {
  const { transid } = req.query;
  const rechargeSt = await axios.get(
    `https://api.techember.in/app/check-status.php?token=${process.env.TECHED_TOKEN}&order_id=${transid}`
  );
  console.log(rechargeSt, "rechargeSt.data");
  successHandler(req, res, {
    Remarks: "Recharge request",
    Data: rechargeSt.data
  });
});


// -------------------------- DTH Recharge --------------------------

const fetchDthPlans = asyncHandler(async (req, res) => {
  try {
    const operatorCode = req.query.operatorCode || 27;
    const apimember_id = process.env.PLAN_API_USER_ID;
    const api_password = process.env.PLAN_API_PASSWORD_hash;
    console.log(req.body);
    const url = "https://planapi.in/api/Mobile/DthPlans";

    const response = await axios.get(url, {
      params: {
        apimember_id,
        api_password,
        operatorcode: operatorCode,
      },
    });

    const data = response.data;
    console.log("dth plan fetch");
    // ✅ Safely extract base fields
    const operator = data?.Operator || "Unknown";
    const combos = data?.RDATA?.Combo || [];

    // ✅ Flatten all plans
    let plans = [];
    for (const combo of combos) {
      const language = combo.Language || "N/A";
      for (const detail of combo.Details || []) {
        const planName = detail.PlanName || "N/A";
        const channels = detail.Channels || "N/A";
        const hdChannels = detail.HdChannels || "N/A";
        const paidChannels = detail.PaidChannels || "N/A";
        const lastUpdate = detail.last_update || null;

        for (const price of detail.PricingList || []) {
          plans.push({
            language,
            planName,
            channels,
            paidChannels,
            hdChannels,
            lastUpdate,
            amount: Number(price.Amount.replace(/[₹\s]/g, "")) || 0,
            month: price.Month,
          });
        }
      }
    }

    // ✅ Apply filters if provided
    const { language, planName, month, price, priceOp } = req.query;

    if (language) {
      plans = plans.filter((p) =>
        p.language.toLowerCase().includes(language.toLowerCase())
      );
    }

    if (planName) {
      plans = plans.filter((p) =>
        p.planName.toLowerCase().includes(planName.toLowerCase())
      );
    }

    if (month) {
      plans = plans.filter((p) =>
        p.month.toLowerCase().includes(month.toLowerCase())
      );
    }

    if (price && priceOp) {
      const priceValue = Number(price);
      if (!isNaN(priceValue)) {
        if (priceOp === "<") plans = plans.filter((p) => p.amount < priceValue);
        else if (priceOp === ">")
          plans = plans.filter((p) => p.amount > priceValue);
        else if (priceOp === "=")
          plans = plans.filter((p) => p.amount === priceValue);
      }
    }

    // ✅ Structured response for frontend
    const formattedResponse = {
      Error: false,
      Status: true,
      ResponseStatus: 1,
      Remarks: "DTH Plans fetched successfully",
      Data: {
        operator,
        totalPlans: plans.length,
        plans,
      },
    };
    console.log("plan fetch successfully");

    return successHandler(req, res, formattedResponse);
  } catch (error) {
    console.error("Error fetching DTH plans:", error.message);
    throw new Error(error.message || "Unable to fetch DTH plans");
  }
});


const fetchDthOperator = asyncHandler(async (req, res) => {
  try {
    const { dthNumber } = req.query;
    if (!dthNumber) {
      throw new Error("DTH number is required");
    }

    const params = {
      apimember_id: process.env.PLAN_API_USER_ID,
      api_password: process.env.PLAN_API_PASSWORD_hash,
      dth_number: dthNumber,
      // Opcode: 24, // Operator code for DTH - FOR MORE DETAILS
      // mobile_no: dthNumber, - for more details
    };

    


    const url = "https://planapi.in/api/Mobile/DthOperatorFetch";
    // const url = "https://planapi.in/api/Mobile/DthInfoWithLastRechargeDate"; // for more details

    const { data } = await axios.get(url, { params });

    console.log(data, "dth operator data");


     try {
    let userName = "Unknown";
    const detailsParams = {
      apimember_id: process.env.PLAN_API_USER_ID,
      api_password: process.env.PLAN_API_PASSWORD_hash,
      dth_number: dthNumber,
      Opcode: data.DthOpCode, // Operator code for DTH - FOR MORE DETAILS
      mobile_no: dthNumber, // - for more details
    };

    const dthurl = "https://planapi.in/api/Mobile/DthInfoWithLastRechargeDate"; // for more details

    const { data:news } = await axios.get(dthurl, { params: detailsParams });


          // userName = data.DATA.Name;
      console.log("------------------------------------------------------------------");
      // console.log("qwe",news.DATA.Name)
      if (!news?.DATA?.Name) {
        return res.status(404).json({
          Error: true,
          Status: false,
          ResponseStatus: 0,
          StatusCode: "Ex404",
          Remarks: "Wrong DTH ID"
        });
      }
    data.userName=news.DATA.Name
    console.log(news.DATA.Name, "dth details data");
    console.log("------------------------------------------------------------------");
  }
  catch (error) {
    console.error("DTH Recharge Pre-fetch Error:", error.message || error.response?.data || error);
  }



    return successHandler(req, res, {
      Error: false,
      Status: true,
      Data: data,
    });
  } catch (error) {
    // console.error("DTH Operator Fetch Error:", error.message);
    throw new Error(error.message || "Unable to fetch DTH operator info");
  }
});

const fetchDthOpDetails = asyncHandler(async (req, res) => {
  try {
    const { dthNumber, operatorCode } = req.query;
    if (!dthNumber) {
      throw new Error("DTH number is required");
    }

    const params = {
      apimember_id: process.env.PLAN_API_USER_ID,
      api_password: process.env.PLAN_API_PASSWORD_hash,
      dth_number: dthNumber,
      Opcode: operatorCode, // Operator code for DTH - FOR MORE DETAILS
      mobile_no: dthNumber, // - for more details
    };

    console.log(params, "params");

    // const url = "https://planapi.in/api/Mobile/DthOperatorFetch";
    const url = "https://planapi.in/api/Mobile/DthInfoWithLastRechargeDate"; // for more details

    const { data } = await axios.get(url, { params });

    return successHandler(req, res, {
      Error: false,
      Status: true,
      Data: data,
    });
  } catch (error) {
    // console.error("DTH Operator Fetch Error:", error.message);
    throw new Error(error.message || "Unable to fetch DTH operator info");
  }
});


const dthRequest = asyncHandler(async (req, res) => {

  const findService = await Service.findOne({ name: "DTH" });
  const ipAddress = getIpAddress(req);

  if (!findService?.status) throw new Error("DTH Recharge Failed, Please Try Again Ex100");
  const { _id, deviceToken } = req.data;
  const FindUser = await Users.findById(_id);
  if (!FindUser?.status) throw new Error("User is Blocked");
  if (!FindUser?.dth) throw new Error("DTH Recharge Failed, Please Try Again Ex150");

  const { number, operator, amount, transactionId = genTxnId(), mPin } = req.query;
  const txnAmount = Number(amount);
  if (txnAmount <= 0) throw new Error("Amount should be positive.");
  if (operator == 28 && txnAmount < 200) {
    res.status(400);
    throw new Error("Minimum Amount for Tata Sky should be greater than 200")
  }
  else if (operator == 25 && txnAmount < 100) {
    res.status(400);
    throw new Error("Minimum Amount for Dish TV should be greater than 100")
  }
  else if (operator == 29 && txnAmount < 100) {
    res.status(400);
    throw new Error("Minimum Amount for Videocon should be greater than 200")
  }
  else if (operator == 24 && txnAmount < 100) {
    res.status(400);
    throw new Error("Minimum Amount for Dish TV should be greater than 200")
  }
  if (!req.data.mPin) throw new Error("Please set an mPin.");

  // 🔐 Decrypt mPin
  const decryptMpin = CryptoJS.AES.decrypt(req.data.mPin, CRYPTO_SECRET).toString(CryptoJS.enc.Utf8);
  if (mPin.toString() !== decryptMpin) throw new Error("Please enter a valid mPin.");

  // 💰 Wallet Check
  const walletFound = await Wallet.findOne({ userId: _id });
  if (!walletFound || walletFound.balance < txnAmount) throw new Error("User wallet balance is low.");

  // ✅ Start Transaction
  const orderId = generateOrderId();
  const payBody = {
    orderId,
    txnAmount,
    txnId: transactionId,
    serviceId: findService._id,
    mPin,
    userId: _id,
    ipAddress,
  };

  let userName = "Unknown";
  try {
  
    const detailsParams = {
      apimember_id: process.env.PLAN_API_USER_ID,
      api_password: process.env.PLAN_API_PASSWORD_hash,
      dth_number: number,
      Opcode: operator, // Operator code for DTH - FOR MORE DETAILS
      mobile_no: number, // - for more details
    };

    const dthurl = "https://planapi.in/api/Mobile/DthInfoWithLastRechargeDate"; // for more details

    const { data } = await axios.get(dthurl, { params: detailsParams });
    userName = data.DATA.Name;
    console.log("------------------------------------------------------------------");
    console.log(data.DATA.Name, "dth details data");
    console.log("------------------------------------------------------------------");
  }
  catch (error) {
    console.error("DTH Recharge Pre-fetch Error:", error.message || error.response?.data || error);
  }

  try {
    const walletRes = await paywithWallet({ body: payBody });
    if (walletRes.ResponseStatus !== 1) throw new Error("Wallet deduction failed.");
    console.log("req.body", req.body);
    console.log("req.query", req.query);
    // 🔎 Validate operator
    console.log(operator)
    const findOperator = All_DTH_Recharge_Operator_List.find(
      (a) => a.planApi_operator_code == operator
    );
    console.log("es", findOperator)
    if (!findOperator) throw new Error("Invalid operator selected.");
    console.log(findOperator, "find op")
    const URL = "https://api.techember.in/app/recharges/main.php";
    const bodyData = {
      token: process.env.BILLHUB_TOKEN,
      number,
      op_uid: findOperator.Billhub_Operator_code,
      amount: txnAmount,
      order_id: orderId,
      type: "dth",
      circle: "N/A",
    };

    await saveLog("DTH_RECHARGE", URL, bodyData, null, `Recharge initiated for TxnID: ${transactionId}`);

    // 🔌 Call Billhub API
    // const rechargeRe = await axios.post(URL, bodyData);
    const rechargeRe = {
      data: {
        status: 'success',
        order_id: '1762671148848568',
        margin: '0.8250',
        margin_percentage: '0.1283',
        operator_ref_id: null
      }
    }
    console.log("data", rechargeRe);
    const rechargeData = rechargeRe.data || {};
    const status = rechargeData.status?.toLowerCase() || "unknown";

    await saveLog(
      "DTH_RECHARGE",
      URL,
      bodyData,
      rechargeData,
      `Recharge response for TxnID: ${transactionId}, Status: ${status}`
    );

    // 🧾 Always record recharge attempt
    const newRecharge = await DTH.create({
      userId: _id,
      number,
      operator,
      amount: txnAmount,
      transactionId,
      userName,
      status: rechargeData.status,
      operatorRef: rechargeData.operator_ref_id || 0,
      apiTransID: rechargeData.order_id || 0,
      ipAddress,
      provider: "Billhub",
    });

    // ❌ Failed Recharge → Refund
    if (["failed", "error", "failure"].includes(status)) {
      await handleRefund(FindUser, txnAmount, transactionId, ipAddress, walletFound);
      throw new Error(rechargeData.message || rechargeData.opid || "Recharge failed.");
    }

    // ✅ Pending / Success / Accepted
    const notification = {
      title: `DTH Recharge ${rechargeData.status}`,
      body: `Your ₹${txnAmount} DTH recharge is ${rechargeData.status}`,
    };
    await Notification.create({ ...notification, recipient: _id });
    if (deviceToken) sendNotification(notification, deviceToken);

    // 🎁 Cashback only on success
    if (status === "success") {


       const op = findOperator.Operator_name;
            // console.log("Found Operator Name:", findOperator);
            console.log("Operator for Cashback:", op);
            const commission = await Commission.findOne({ name : op });
            console.log("Commission Details:", commission);
            const findPercent = commission ? commission.commission : 0;
            console.log("Cashback Percent:", findPercent);
            const cashbackPercent = (txnAmount / 100) * findPercent;
            console.log("Calculated Cashback Amount:", cashbackPercent);

      await handleCashback(FindUser, cashbackPercent, transactionId, ipAddress, walletFound);
    }

    // ✅ Always respond (success/pending/accepted)
    return successHandler(req, res, {
      Remarks:
        rechargeData.message ||
        rechargeData.ErrorMessage ||
        `Recharge ${status}`,
      Data: rechargeData,
      ResponseStatus: 1
    });

  } catch (error) {
    console.error("DTH Recharge Error:", error);

    // ⚙️ Auto-refund on API error (if wallet already deducted)
    try {
      await handleRefund(FindUser, txnAmount, transactionId, ipAddress, walletFound);
    } catch (refundErr) {
      console.error("Refund Error:", refundErr.message);
    }

    await saveLog(
      "DTH_RECHARGE",
      null,
      null,
      error?.response?.data || error?.message,
      `Error during recharge for TxnID: ${transactionId}`
    );

    res.status(400);
    throw new Error(error.message || "DTH Recharge Failed, Please Try Again Ex200");
  }
});


// recharge status
// const rechargeStatus = asyncHandler(async (req, res) => {
//   const { transid } = req.query;

//   const rechargeSt = await axios.get(
//     `${recharge_status}?memberid=${CYRUS_MEMBER_ID}&pin=${CYRUS_PAYMENT_KEY}transid=${transid}`
//   );

//   // if error
//   if (rechargeSt.data.Status != "FAILURE") {
//     // success respond
//     successHandler(req, res, {
//       Remarks: "Recharge request",
//       Data: rechargeSt.data,
//     });
//   } else {
//     res.status(400);
//     throw new Error(rechargeSt?.data?.ErrorMessage);
//   }
// });

// dth info fetch
// const dthInfoFetch = asyncHandler(async (req, res) => {
//   const { MethodName, operator, mobile, offer } = req.query;

//   const dthInfo = await axios.get(
//     `${dth_info_fetch}?MerchantID=${CYRUS_MEMBER_ID}&MerchantKey=${CYRUS_PAYMENT_KEY}MethodName=${MethodName}&operator=${operator}&mobile=${mobile}&offer=${offer}`
//   );

//   // if error
//   if (dthInfo.data.Status != "FAILURE") {
//     // success respond
//     successHandler(req, res, {
//       Remarks: "DTH Info Fetch",
//       Data: dthInfo.data,
//     });
//   } else {
//     res.status(400);
//     throw new Error(dthInfo?.data?.ErrorMessage);
//   }
// });

// recharge history by User
const rechargeHistory = asyncHandler(async (req, res) => {
  const { _id } = req.data;
  const hist = await Recharge.find({ userId: _id }).sort({ createdAt: -1 }); // Sort by createdAt field in descending order

  // success handler
  successHandler(req, res, {
    Remarks: "User Recharge History",
    Data: hist,
  });
});

// Operator & Circle Fetch by Phone
const Get_Operator_Circle_By_Phone = asyncHandler(async (req, res) => {
  const { phone } = req.query;

  if (!phone) {
    res.status(400);
    throw new Error("Phone Number is Mandatory");
  }

  const response = await axios.get(
    `http://planapi.in/api/Mobile/OperatorFetchNew?ApiUserID=${process.env.PLAN_API_USER_ID}&ApiPassword=${process.env.PLAN_API_PASSWORD}&Mobileno=${phone}`
  );
  if (response.data.STATUS == 3) {
    res.status(400);
    throw new Error(response.data.Message);
  } else {
    const operatorTypeFilter = mobileTypeCheck
      .filter(a => a.op_code === response.data.op_code)
      .map(a => a.type);
    response.data.operatorType = operatorTypeFilter.length > 0 ? operatorTypeFilter[0] : "N/A";
    successHandler(req, res, {
      Remarks: "Operator & Circle Fetch Success",
      Data: response.data,
    });
  }
});

//  recharge history by admin
const rechargeHistoryByAdmin = asyncHandler(async (req, res) => {
  const page = parseInt(req.body.pageNumber) || 1; // Default page number is 1
  const pageSize = parseInt(req.body.pageSize) || 20; // Default page size is 20
  const searchVal = req.body.search || "";
  const selectVal = req.body.select || "";
  const startDate = new Date(req.body.startDate) || "";
  const endDate = new Date(req.body.endDate) || "";
  const activeTab = req.body.activeTab || "";

  let allRecharges;
  let LastPage;

  if (
    searchVal ||
    selectVal ||
    req.body.startDate ||
    req.body.endDate ||
    activeTab
  ) {
    if (
      selectVal === "phone" ||
      selectVal === "number" ||
      selectVal === "transactionId" ||
      selectVal === "_id"
    ) {
      if (selectVal !== "transactionId" && selectVal !== "number") {
        const FindUser = await Users.findOne({ [selectVal]: searchVal });
        if (FindUser) {
          allRecharges = await Recharge.find({ userId: FindUser._id })
            .sort({ createdAt: -1 })
            .skip((page - 1) * pageSize)
            .limit(pageSize)
            .populate("userId");

          LastPage = Math.ceil(
            (await Recharge.countDocuments({ userId: FindUser._id })) / pageSize
          );
        } else {
          res.status(400);
          throw new Error(`${selectVal} - ${searchVal} is Incorrect`);
        }
      } else {
        allRecharges = await Recharge.find({ [selectVal]: searchVal })
          .sort({ createdAt: -1 })
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .populate("userId");
        LastPage = Math.ceil(
          (await Recharge.countDocuments({ [selectVal]: searchVal })) / pageSize
        );
      }
    } else if (startDate && endDate && !activeTab) {
      allRecharges = await Recharge.find({
        createdAt: {
          $gte: startDate,
          $lte: endDate,
        },
      })
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .populate("userId");

      LastPage = Math.ceil((await Recharge.countDocuments()) / pageSize);
    } else if (activeTab) {
      if (activeTab === "select") {
        allRecharges = await Recharge.find()
          .sort({ createdAt: -1 })
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .populate("userId");

        LastPage = Math.ceil((await Recharge.countDocuments()) / pageSize);
      } else {
        let statusValues;

        if (activeTab === "Failure") {
          statusValues = ["Failure", "Failed"];
        } else {
          statusValues = [activeTab];
        }

        allRecharges = await Recharge.find({ status: { $in: statusValues } })
          .sort({ createdAt: -1 })
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .populate("userId");

        LastPage = Math.ceil((await Recharge.countDocuments()) / pageSize);
      }
    }
  } else {
    allRecharges = await Recharge.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .populate("userId");

    LastPage = Math.ceil((await Recharge.countDocuments()) / pageSize);
  }

  // const hist = await Recharge.find().populate("userId");
  // success handler
  successHandler(req, res, {
    Remarks: "Fetch Recharge History",
    Data: {
      data: allRecharges,
      lastPage: LastPage,
    },
    // Data: encryptFunc(allRecharges),
  });
});

// recharge history
const dthHistory = asyncHandler(async (req, res) => {
  const { _id } = req.data;
  const hist = await DTH.find({ userId: _id }).sort({ createdAt: -1 });
  // success handler
  successHandler(req, res, {
    Remarks: "User DTH Recharge History",
    Data: hist,
  });
});

const fetchDthOperators = asyncHandler(async (req, res) => {
  // const { _id } = req.data;
  const operators = All_DTH_Recharge_Operator_List.filter(op => {
    return op.Billhub_Operator_code && op.Operator_name && op.img;
  })
  // success handler
  successHandler(req, res, {
    Remarks: "User DTH Operators",
    Data: operators,
  });
});

// recharge history by admin
const dthHistoryByAdmin = asyncHandler(async (req, res) => {
  const hist = await DTH.find().populate("userId");
  // success handler
  successHandler(req, res, {
    Remarks: "Fetch DTH Recharge History",
    Data: (hist.reverse()),
  });
});

// ----------- If recharge fail when initiate refund by admin ------------ //
const handleFailedRecharge = asyncHandler(async (req, res) => {
  const { rechargeId } = req.body;
  if (!rechargeId) {
    res.status(400);
    throw new Error("Please fill all fields");
  }
  const findRecharge = await Recharge.findOne({ _id: rechargeId });

  if (findRecharge.status === "Refunded") {
    res.status(400);
    throw new Error("Already refunded.");
  } else {
    if (findRecharge) {
      const findTxn = await Transaction.findOne({
        txnId: findRecharge.transactionId,
        userId: findRecharge.userId,
      });
      const userFound = await User.findById(findRecharge.userId);
      const findService = await Service.findById(findTxn?.serviceId);
      const percent =
        (findTxn.txnAmount / 100) *
        (findTxn.isUsePrime ? 25 : findService.percent);

      // update wallet
      await Wallet.updateOne(
        { userId: findRecharge.userId },
        {
          $inc: {
            balance: findTxn.txnAmount - percent,
            goPoints: findTxn.isUsePrime ? 0 : percent,
            primePoints: findTxn.isUsePrime ? percent : 0,
          },
        }
      );

      // Push notification
      const notification = {
        title: "Recharge Refund",
        body: `Your recharge refund ${findTxn.txnAmount} rupay is refunded into wallet.`,
      };
      // save notification
      const newNotification = new Notification({
        ...notification,
        recipient: findRecharge.userId,
      });
      await newNotification.save();
      userFound.deviceToken &&
        sendNotification(notification, userFound.deviceToken);

      // ----------- Create Txn History ------------- //
      const subtractBalance = new Transaction({
        userId: userFound._id,
        recipientId: userFound._id,
        txnName: "Recharge Refund",
        txnDesc: "Your recharge refund issued.",
        txnAmount: findTxn.txnAmount,
        txnType: "credit",
        txnStatus: "TXN_SUCCESS",
        txnResource: "Wallet",
        txnId: Math.floor(Math.random() * Date.now()) + "refund",
        orderId: Math.floor(Math.random() * Date.now()) + "refund",
        ipAddress: getIpAddress(req),
      });
      await subtractBalance.save(); // wallet balance history
      const subtractGoPoints = new Transaction({
        userId: userFound._id,
        recipientId: userFound._id,
        txnName: "Recharge Refund",
        txnDesc: "Your recharge refund issued.",
        txnType: "credit",
        txnStatus: "TXN_SUCCESS",
        txnResource: findTxn.isUsePrime ? "PrimePoints" : "GoPoints",
        txnId: Math.floor(Math.random() * Date.now()) + "refund",
        orderId: Math.floor(Math.random() * Date.now()) + "refund",
        txnAmount: percent,
        ipAddress: getIpAddress(req),
      });
      await subtractGoPoints.save(); // go points history

      await Recharge.updateOne({ _id: rechargeId }, { status: "Refunded" });
      successHandler(req, res, { Remarks: "Refund issued success" });
    } else {
      res.status(400);
      throw new Error("Please enter valid recharge id.");
    }
  }
});

const commission = asyncHandler(async (req, res) => {
  console.log("commission api called");
  return successHandler(req, res, {
    Remarks: "Commission fetched successfully",
    data: {
      mobile: {
        Airtel: {
          commission: 2.5,
          icon: "uploads/operator/airtel.jpg",
        },
        Jio: {
          commission: 3,
          icon: "uploads/operator/jio.jpg",
        },
        Vi: {
          commission: 4.5,
          icon: "uploads/operator/vi.jpg",
        },
        Bsnl: {
          commission: 5,
          icon: "uploads/operator/bsnl.jpg",
        },
      },
      dth: {
        Airtel: {
          icon: "uploads/operator/airtel.jpg",
          commission: 1,
        },
        "Sun Direct": {
          icon: "uploads/operator/sun_tv.jpg",
          commission: 1.5,
        },
        Videocon: {
          icon: "uploads/operator/videocon.jpg",
          commission: 1.2,
        },
        "Tata Sky": {
          icon: "uploads/operator/tata_sky.jpg",
          commission: 2.1,
        },
      },
      bbps: {
        Water: {
          icon: "uploads/services/water.png",
          commission: 3,
        },
        Gas: {
          icon: "uploads/services/Book-gas-cylinder-icon.png",
          commission: 3,
        },
        Electricity: {
          icon: "uploads/services/electricity-bill-icon.png",
          commission: 4,
        },
        Insurance: {
          icon: "uploads/services/insurance.png",
          commission: 3,
        },
        Postpaid: {
          icon: "uploads/services/postpaid.png",
          commission: 2,
        },
        "Fast Card": {
          icon: "uploads/services/fastag.png",
          commission: 2,
        },
        "Google Play": {
          icon: "uploads/services/google-play.png",
          commission: 2.12,
        },
      },
    },
  });
});
// const Recharge_CallBack_Handler = asyncHandler(async (req, res) => {
//   const Status =
//     req.query.Status || req.query.status || req.query.STATUS === 1
//       ? "success"
//       : "failed";
//   const TransID = req.query.TransID || req.query.txid || req.query.RRR;
//   if (!Status || !TransID) {
//     return res.status(400).json({ error: "Missing parameters" });
//   }

//   function sendEmail() {
//     // Set up a transporter object with Gmail credentials
//     const transporter = nodemailer.createTransport({
//       host: "smtp.gmail.com",
//       port: 587,
//       secure: false,
//       auth: {
//         user: service_email,
//         pass: service_email_password,
//       },
//     });

//     const mailOptions = {
//       from: service_email,
//       to: "hinditutors.com@gmail.com",
//       subject: "Recharge Callback Handle",
//       html: `<html>
//       <head></head>
//       <body>
//       <h2>Status : ${Status}</h2>
//       <h2>TransID : ${TransID}</h2>

//       </body>
//     </html>`,
//     };

//     // Send the email
//     transporter.sendMail(mailOptions, (error, info) => {
//       if (error) {
//         console.error("error", error);
//       } else {
//         console.log(`Email sent: ${info.response}`);
//       }
//     });
//   }
//   sendEmail();

//   const findRecord = await Recharge.findOne({
//     transactionId: TransID,
//   });
//   console.log(findRecord, "findRecord");

//   if (findRecord) {
//     console.log("findRecord ke andar");

//     const findTxn = await Transaction.findOne({
//       txnId: findRecord.transactionId,
//       userId: findRecord.userId,
//     });
//     console.log(findTxn, "findTxn");

//     const findService = await Service.findById(findTxn?.serviceId);
//     console.log(findService, "findService,");

//     const percent = (findTxn.txnAmount / 100) * findService.percent;
//     const userFound = await User.findById(findRecord.userId);
//     console.log(userFound, "userFound,");

//     const walletFound = await Wallet.findOne({ userId: userFound._id });
//     console.log(walletFound, "walletFound,");

//     if (
//       (Status.toLowerCase() === "failed" ||
//         Status.toLowerCase() === "failure") &&
//       findRecord.status.toLowerCase() === "pending"
//     ) {
//       console.log("pending to failed,");

//       await Recharge.findOneAndUpdate(
//         {
//           transactionId: TransID,
//         },
//         { $set: { status: Status } }
//       );

//       // Send Notificaiton for Failed Recharge
//       const notification = {
//         title: "Recharge Failed",
//         body: `Your ${findTxn.txnAmount} recharge is Failed`,
//       };
//       // save notification
//       const newNotification = new Notification({
//         ...notification,
//         recipient: findRecord.userId,
//       });
//       await newNotification.save();
//       // push notification
//       userFound.deviceToken &&
//         sendNotification(notification, userFound.deviceToken);

//       // Refund Amount to User Wallet
//       await Wallet.updateOne(
//         { userId: findRecord.userId },
//         {
//           $inc: {
//             balance: findTxn.txnAmount,
//           },
//         }
//       );

//       // Push notification
//       const Refundnotification = {
//         title: "Recharge Refund",
//         body: `Your recharge refund â‚¹${findTxn.txnAmount} is refunded into wallet.`,
//       };
//       // save notification
//       const newRefundNotification = new Notification({
//         ...Refundnotification,
//         recipient: findRecord.userId,
//       });
//       await newRefundNotification.save();
//       userFound.deviceToken &&
//         sendNotification(Refundnotification, userFound.deviceToken);

//       // ----------- Create Txn History ------------- //
//       const subtractBalance = new Transaction({
//         userId: userFound._id,
//         recipientId: userFound._id,
//         txnName: "Recharge Refund",
//         txnDesc: "Your recharge refund issued.",
//         txnAmount: findTxn.txnAmount,
//         txnType: "credit",
//         txnStatus: "TXN_SUCCESS",
//         txnResource: "Wallet",
//         txnId: TransID + "refund",
//         orderId: TransID + "refund",
//         ipAddress: getIpAddress(req),
//       });
//       await subtractBalance.save(); // wallet balance history
//       const subtractGoPoints = new Transaction({
//         userId: userFound._id,
//         recipientId: userFound._id,
//         txnName: "Recharge Refund",
//         txnDesc: "Your recharge refund issued.",
//         txnType: "credit",
//         txnStatus: "TXN_SUCCESS",
//         txnResource: findTxn.isUsePrime ? "PrimePoints" : "GoPoints",
//         txnId: TransID + (findTxn.isUsePrime ? "primerefund" : "gorefund"),
//         orderId: TransID + (findTxn.isUsePrime ? "primerefund" : "gorefund"),
//         txnAmount: percent,
//         ipAddress: getIpAddress(req),
//       });
//       await subtractGoPoints.save(); // go points history

//       res.status(200).send("Callback processed successfully");
//     } else if (
//       Status.toLowerCase() === "success" &&
//       findRecord.status.toLowerCase() === "pending"
//     ) {
//       console.log("pending to succwss,");

//       await Recharge.findOneAndUpdate(
//         {
//           transactionId: TransID,
//         },
//         { $set: { status: Status } }
//       );

//       // Send Notificaiton for Success Recharge
//       const notification = {
//         title: "Recharge Sucess",
//         body: `Your ${findTxn.txnAmount} recharge is Success`,
//       };
//       // save notification
//       const newNotification = new Notification({
//         ...notification,
//         recipient: findRecord.userId,
//       });
//       await newNotification.save();
//       // push notification
//       userFound.deviceToken &&
//         sendNotification(notification, userFound.deviceToken);

//       // Handle Cashback

//       const cashbackPercent =
//         (parseInt(findTxn.txnAmount) / 100) * findService.percent; // for both (prime & non prime)
//       const ipAddress = getIpAddress(req);
//       await handleCashback(
//         userFound,
//         cashbackPercent,
//         TransID,
//         ipAddress,
//         walletFound
//       );
//       res.status(200).send("Callback processed successfully");
//     } else if (
//       (Status.toLowerCase() === "failed" ||
//         Status.toLowerCase() === "failure") &&
//       findRecord.status.toLowerCase() === "success"
//     ) {
//       await Recharge.findOneAndUpdate(
//         {
//           transactionId: TransID,
//         },
//         { $set: { status: Status } }
//       );

//       // Send Notificaiton for Success Recharge
//       const notification = {
//         title: "Recharge Failed",
//         body: `Your ${findTxn.txnAmount} recharge is Failed`,
//       };
//       // save notification
//       const newNotification = new Notification({
//         ...notification,
//         recipient: findRecord.userId,
//       });
//       await newNotification.save();
//       // push notification
//       userFound.deviceToken &&
//         sendNotification(notification, userFound.deviceToken);

//       const findGoTxn = await Transaction.findOne({
//         txnId: TransID + "go",
//       });

//       // handle Money Refund & Points Refund

//       // ----------- Create Txn History ------------- //
//       const refundBalance = new Transaction({
//         userId: userFound._id,
//         recipientId: userFound._id,
//         txnName: "Recharge Refund",
//         txnDesc: "Your recharge refund Success.",
//         txnAmount: findTxn.txnAmount - findGoTxn.txnAmount,
//         txnType: "credit",
//         txnStatus: "TXN_SUCCESS",
//         txnResource: "Wallet",
//         txnId: TransID + "refund",
//         orderId: TransID + "refund",
//         ipAddress: getIpAddress(req),
//       });
//       await refundBalance.save(); // wallet balance history
//       const refundGoPoints = new Transaction({
//         userId: userFound._id,
//         recipientId: userFound._id,
//         txnName: "Recharge Refund",
//         txnDesc: "Your recharge refund issued.",
//         txnType: "credit",
//         txnStatus: "TXN_SUCCESS",
//         txnResource: findTxn.isUsePrime ? "PrimePoints" : "GoPoints",
//         txnId: TransID + (findTxn.isUsePrime ? "Prime" : "go") + "refund",
//         orderId: TransID + (findTxn.isUsePrime ? "Prime" : "go") + "refund",
//         txnAmount: findGoTxn.txnAmount,
//         ipAddress: getIpAddress(req),
//       });
//       await refundGoPoints.save(); // go points history

//       // Refund Amount to User Wallet
//       await Wallet.updateOne(
//         { userId: findRecord.userId },
//         {
//           $inc: {
//             balance: findTxn.txnAmount - findGoTxn.txnAmount,
//             goPoints: findTxn.isUsePrime ? 0 : findGoTxn.txnAmount,
//             primePoints: findTxn.isUsePrime ? findGoTxn.txnAmount : 0,
//           },
//         }
//       );

//       const Refundnotification = {
//         title: "Recharge Refund",
//         body: `Your recharge refund ${
//           findTxn.txnAmount - findGoTxn.txnAmount
//         } rupee is refunded into wallet.`,
//       };
//       const newRefundNotification = new Notification({
//         ...Refundnotification,
//         recipient: userFound._id,
//       });
//       await newRefundNotification.save();

//       // send notification
//       userFound?.deviceToken &&
//         sendNotification(Refundnotification, userFound?.deviceToken);
//       res.status(200).send("Callback processed successfully");
//     } else {
//       return res.status(400).json({ error: "No Valid Action" });
//     }
//   } else {
//     const findBBPSRecord = await BBPS.findOne({
//       transactionId: TransID,
//     });
//     const findTxn = await Transaction.findOne({
//       txnId: findBBPSRecord.transactionId,
//       userId: findBBPSRecord.userId,
//     });

//     const findService = await Service.findById(findTxn?.serviceId);

//     const percent =
//       (findTxn.txnAmount / 100) *
//       (findTxn.isUsePrime ? 25 : findService.percent);
//     if (findBBPSRecord) {
//       const userFound = await User.findById(findBBPSRecord.userId);
//       const findTxn = await Transaction.findOne({
//         txnId: findBBPSRecord.transactionId,
//         userId: findBBPSRecord.userId,
//       });

//       if (
//         (Status.toLowerCase() === "failed" ||
//           Status.toLowerCase() === "failure") &&
//         findBBPSRecord.status.toLowerCase() === "pending"
//       ) {
//         await BBPS.findOneAndUpdate(
//           {
//             transactionId: TransID,
//           },
//           { $set: { status: Status } }
//         );
//         // Send Notificaiton for Failed Recharge
//         const notification = {
//           title: "Bill Payment Failed",
//           body: `Your ${findTxn.txnAmount} Payment is Failed`,
//         };
//         // save notification
//         const newNotification = new Notification({
//           ...notification,
//           recipient: findBBPSRecord.userId,
//         });
//         await newNotification.save();
//         // push notification
//         userFound.deviceToken &&
//           sendNotification(notification, userFound.deviceToken);

//         // Refund Amount to User Wallet
//         await Wallet.updateOne(
//           { userId: findBBPSRecord.userId },
//           {
//             $inc: {
//               balance: findTxn.txnAmount,
//             },
//           }
//         );

//         // Push notification
//         const Refundnotification = {
//           title: "Payment Refund",
//           body: `Your Payment ${findTxn.txnAmount} rupee is refunded into wallet.`,
//         };
//         // save notification
//         const newRefundNotification = new Notification({
//           ...Refundnotification,
//           recipient: findBBPSRecord.userId,
//         });
//         await newRefundNotification.save();
//         userFound.deviceToken &&
//           sendNotification(Refundnotification, userFound.deviceToken);

//         // ----------- Create Txn History ------------- //
//         const subtractBalance = new Transaction({
//           userId: userFound._id,
//           recipientId: userFound._id,
//           txnName: "Bill Payment Refund",
//           txnDesc: "Your Payment refund issued.",
//           txnAmount: findTxn.txnAmount,
//           txnType: "credit",
//           txnStatus: "TXN_SUCCESS",
//           txnResource: "Wallet",
//           txnId: TransID + "refund",
//           orderId: TransID + "refund",
//           ipAddress: getIpAddress(req),
//         });
//         await subtractBalance.save();
//         res.status(200).send("Callback processed successfully");
//       } else if (
//         Status.toLowerCase() === "success" &&
//         findBBPSRecord.status.toLowerCase() === "pending"
//       ) {
//         if (findBBPSRecord.operator === "GLF") {
//           await BBPS.findOneAndUpdate(
//             {
//               transactionId: TransID,
//             },
//             { $set: { status: Status, operatorRef: req.query.opid } }
//           );

//           // cashback Amount to User Wallet
//           await Wallet.updateOne(
//             { userId: findBBPSRecord.userId },
//             {
//               $inc: {
//                 balance: (findTxn.txnAmount / 100) * findService.percent,
//               },
//             }
//           );

//           // notification
//           const Cashbacknotification = {
//             title: "Received Cashback",
//             body: `Congratulation...! ðŸŽ‰ You got ${
//               (findTxn.txnAmount / 100) * findService.percent
//             } rupee as a cashback.`,
//           };
//           // save notification
//           const newRefundNotification = new Notification({
//             ...Cashbacknotification,
//             recipient: findBBPSRecord.userId,
//           });
//           await newRefundNotification.save();
//           userFound.deviceToken &&
//             sendNotification(Cashbacknotification, userFound.deviceToken);

//           const subtractGoPoints = new Transaction({
//             userId: userFound._id,
//             recipientId: userFound._id,
//             txnName: "Cashback",
//             txnDesc: `Congratulation...! you got ${
//               (findTxn.txnAmount / 100) * findService.percent
//             } rupee cashback`,
//             txnType: "credit",
//             txnStatus: "TXN_SUCCESS",
//             txnResource: "Wallet",
//             txnId: TransID + "cashback",
//             orderId: TransID + "cashback",
//             txnAmount: (findTxn.txnAmount / 100) * findService.percent,
//             ipAddress: getIpAddress(req),
//           });
//           await subtractGoPoints.save(); // go points history
//         } else {
//           await BBPS.findOneAndUpdate(
//             {
//               transactionId: TransID,
//             },
//             { $set: { status: Status } }
//           );
//           // Send Notificaiton for Success Recharge
//           const notification = {
//             title: "Bill Payment Success",
//             body: `Your ${findTxn.txnAmount} Payment is Success`,
//           };
//           // save notification
//           const newNotification = new Notification({
//             ...notification,
//             recipient: findBBPSRecord.userId,
//           });
//           await newNotification.save();
//           // push notification
//           userFound.deviceToken &&
//             sendNotification(notification, userFound.deviceToken);

//           // Refund Amount to User Wallet
//           await Wallet.updateOne(
//             { userId: findBBPSRecord.userId },
//             {
//               $inc: {
//                 goPoints: percent,
//               },
//             }
//           );

//           // notification
//           const Cashbacknotification = {
//             title: "Received Cashback",
//             body: `Congratulation...! ðŸŽ‰ You got ${percent} goPoints as a cashback.`,
//           };
//           // save notification
//           const newRefundNotification = new Notification({
//             ...Cashbacknotification,
//             recipient: findBBPSRecord.userId,
//           });
//           await newRefundNotification.save();
//           userFound.deviceToken &&
//             sendNotification(Cashbacknotification, userFound.deviceToken);

//           const subtractGoPoints = new Transaction({
//             userId: userFound._id,
//             recipientId: userFound._id,
//             txnName: "Cashback",
//             txnDesc: `Congratulation...! you got ${percent} goPoints cashback`,
//             txnType: "credit",
//             txnStatus: "TXN_SUCCESS",
//             txnResource: "GoPoints",
//             txnId: TransID + "go",
//             orderId: TransID + "go",
//             txnAmount: percent,
//             ipAddress: getIpAddress(req),
//           });
//           await subtractGoPoints.save(); // go points history
//         }

//         res.status(200).send("Callback processed successfully");
//       } else {
//         return res.status(400).json({ error: "No Valid Action" });
//       }
//     } else {
//       return res.status(400).json({ error: "invalid TxnID" });
//     }
//   }
// });


const handleRechargeStatusUpdate = async (TransID, Status) => {
  await Recharge.findOneAndUpdate(
    {
      transactionId: TransID,
    },
    { $set: { status: Status } }
  );
};


const handleBBPSStatusUpdate = async (TransID, Status) => {
  await BBPS.findOneAndUpdate(
    {
      transactionId: TransID,
    },
    { $set: { status: Status } }
  );
};


const handleRechargeSendNotification = async (
  findTxn,
  findRecord,
  userFound,
  Status
) => {
  const notification = {
    title: `Recharge ${Status}`,
    body: `Your ${findTxn.txnAmount} recharge is ${Status}`,
  };
  // save notification
  const newNotification = new Notification({
    ...notification,
    recipient: findRecord.userId,
  });
  await newNotification.save();
  // push notification
  userFound.deviceToken &&
    sendNotification(notification, userFound.deviceToken);
};


const handleBBPSSendNotification = async (
  findTxn,
  findBBPSRecord,
  userFound,
  Status
) => {
  const notification = {
    title: `Bill Payment ${Status}`,
    body: `Your ${findTxn.txnAmount} Payment is ${Status}`,
  };
  // save notification
  const newNotification = new Notification({
    ...notification,
    recipient: findBBPSRecord.userId,
  });
  await newNotification.save();
  // push notification
  userFound.deviceToken &&
    sendNotification(notification, userFound.deviceToken);
};


const handleDTHStatusUpdate = async (TransID, Status) => {
  await DTH.findOneAndUpdate(
    {
      transactionId: TransID,
    },
    { $set: { status: Status } }
  );
};


const handleDTHSendNotification = async (
  findTxn,
  findDTHRecord,
  userFound,
  Status
) => {
  const notification = {
    title: `DTH Recharge is ${Status}`,
    body: `Your â‚¹${findTxn.txnAmount} DTH Recharge is ${Status}`,
  };
  // save notification
  const newNotification = new Notification({
    ...notification,
    recipient: findDTHRecord.userId,
  });
  await newNotification.save();
  // push notification
  userFound.deviceToken &&
    sendNotification(notification, userFound.deviceToken);
};


const Recharge_CallBack_Handler = asyncHandler(async (req, res) => {
  try {
    console.log("-----------------------------")
    console.log("Recharge Callback Handler Invoked");
    if (req?.method) console.log("Request Method:", req.method);
    if (req?.body) console.log("Request Body:", req.body);
    if (req?.query) console.log("Request Query:", req.query);
    if (req?.params) console.log("Params:", req.params);
    console.log("-----------------------------")
    let Status;
    let TransID;

    if (req.method === "POST") {
      Status = req.body.Status || req.body.status || 0;
      TransID = req.body.order_id || 0;

      // Log raw data for debugging
      console.log("Logging webhook data to file");
      const logFile = path.join(process.cwd(), "webhook_logs.txt");
      console.log("Logging to file:", logFile);
      fs.appendFileSync(logFile, `${new Date().toISOString()} - ${req.method} - ${JSON.stringify(req.body)}\n`);
      console.log("Logged webhook data successfully");
    } else if (req.method === "GET") {
      console.log("Processing GET request");
      Status = req?.query?.Status || req?.query?.status || req?.query?.STATUS === 1 ? "success" : "failed";
      console.log("Parsed Status:", Status);
      // Log raw data for debugging
      const logFile = path.join(process.cwd(), "webhook_logs.txt");
      console.log("Logging to file:", logFile);
      fs.appendFileSync(logFile, `${new Date().toISOString()} - ${req.method} - ${JSON.stringify(req.data)}\n`);
      console.log("Logged webhook data successfully");


      TransID =
        req.query.TransID ||
        req.query.txid ||
        req.query.RRR ||
        req.query.order_id;
    }
    if (!Status || !TransID) {
      return res.status(400).json({ error: "Missing parameters" });
    }
    //     sendEmail(
    //   {
    //     phone: "calling",
    //     firstName: `Status : ${Status}, TransID : ${TransID}`,
    //   },
    //   "USER_CONGRATES"
    // );
    const findRecord = await Recharge.findOne({
      transactionId: TransID,
    });

    if (findRecord) {
      const findTxn = await Transaction.findOne({
        txnId: findRecord.transactionId,
        userId: findRecord.userId,
      });

      const findService = await Service.findById(findTxn?.serviceId);

      const percent = (findTxn.txnAmount / 100) * findService.percent;
      const userFound = await User.findById(findRecord.userId);

      const walletFound = await Wallet.findOne({ userId: userFound._id });

      if (
        (Status.toLowerCase() === "failed" ||
          Status.toLowerCase() === "failure") &&
        (findRecord.status.toLowerCase() === "pending" ||
          findRecord.status.toLowerCase() === "error")
      ) {
        await saveLog(
          `MOBILE_RECHARGE`,
          "https://api.techemall.in/reseller/recharge",
          "https://google.com/api/wallet/callback",
          req.body || req.query,
          `Recharge Callback Status Update : ${Status} for TxnID: ${TransID}`
        );
        await handleRechargeStatusUpdate(TransID, Status);

        // Send Notificaiton for Failed Recharge

        await handleRechargeSendNotification(
          findTxn,
          findRecord,
          userFound,
          Status
        );

        //   Refund Amount Start------------------------
        const FindUser = userFound;
        const amount = findTxn.txnAmount;
        const transactionId = TransID;
        const ipAddress = getIpAddress(req);
        await handleRefund(
          FindUser,
          amount,
          transactionId,
          ipAddress,
          walletFound
        );

        res.status(200).send("Callback processed successfully");
      } else if (
        Status.toLowerCase() === "success" &&
        (findRecord.status.toLowerCase() === "pending" ||
          findRecord.status.toLowerCase() === "error")
      ) {
        await saveLog(
          `MOBILE_RECHARGE`,
          `${findRecord.provider == "Billhub"
            ? "https://api.techember.in/reseller/recharge"
            : "https://business.a1topup.com/recharge/api"
          }`,
          "https://production-api.google.info/api/wallet/callback", // or full request payload
          req.body || req.query,
          `Recharge Callback Status Update : ${Status} for TxnID: ${TransID}`
        );
        await handleRechargeStatusUpdate(TransID, Status);

        // Send Notificaiton for Success Recharge
        await handleRechargeSendNotification(
          findTxn,
          findRecord,
          userFound,
          Status
        );

        // Handle Cashback

        const findRechargeOperator = await RechargeOperator.findOne({
          serviceId: findService._id,
        });
        if (!findRechargeOperator) {
          throw new Error("Recharge operator or operator data not found.");
        }
        let findPercent;
        const operatorMapping = {
          2: findRechargeOperator.airtel,
          11: findRechargeOperator.jio,
          23: findRechargeOperator.vi,
          4: findRechargeOperator.bsnl,
        };
        findPercent = operatorMapping[findRecord.operator] || 0; // Default 0 if not found
        const cashbackPercent =
          (parseInt(findTxn.txnAmount) / 100) * findPercent;
        const ipAddress = getIpAddress(req);
        await handleCashback(
          userFound,
          cashbackPercent,
          TransID,
          ipAddress,
          walletFound
        );
        res.status(200).send("Callback processed successfully");
      } else if (
        (Status.toLowerCase() === "failed" ||
          Status.toLowerCase() === "failure") &&
        findRecord.status.toLowerCase() === "success"
      ) {
        await handleRechargeStatusUpdate(TransID, Status);

        // Send Notificaiton for Success Recharge
        await handleRechargeSendNotification(
          findTxn,
          findRecord,
          userFound,
          Status
        );
        const ipAddress = getIpAddress(req);
        const findCashbackTxn = await Transaction.findOne({
          txnId: `${findRecord.transactionId}cashback`,
          userId: findRecord.userId,
        });

        // HandleRefund
        await handleDisputeRefund(
          userFound,
          findTxn,
          findCashbackTxn,
          TransID,
          ipAddress,
          walletFound
        );
        // Refund Sucess
        res.status(200).send("Callback processed successfully");
      } else {
        res.status(200).json("No Valid Action");
      }
    } else {
      const findBBPSRecord = await BBPS.findOne({
        transactionId: TransID,
      });

      if (findBBPSRecord) {
        const findTxn = await Transaction.findOne({
          txnId: findBBPSRecord.transactionId,
          userId: findBBPSRecord.userId,
        });
        const findService = await Service.findById(findTxn?.serviceId);

        const percent = (findTxn.txnAmount / 100) * findService.percent;
        const userFound = await User.findById(findBBPSRecord.userId);
        const walletFound = await Wallet.findOne({ userId: userFound._id });

        if (
          (Status.toLowerCase() === "failed" ||
            Status.toLowerCase() === "failure") &&
          findBBPSRecord.status.toLowerCase() === "pending"
        ) {
          await saveLog(
            `BILL_PAYMENT`,
            `${findRecord.provider == "Billhub"
              ? "https://api.billhub.in/reseller/recharge"
              : "https://business.a1topup.com/recharge/api"
            }`,
            "https://production-api.google.info/api/wallet/callback", // or full request payload
            req.body || req.query,
            `Recharge Callback Status Update : ${Status} for TxnID: ${TransID}`
          );
          await handleBBPSStatusUpdate(TransID, Status);
          // Send Notificaiton for Failed Recharge
          await handleBBPSSendNotification(
            findTxn,
            findBBPSRecord,
            userFound,
            Status
          );

          const FindUser = userFound;
          const amount = findTxn.txnAmount;
          const transactionId = TransID;
          const ipAddress = getIpAddress(req);

          await handleRefund(
            FindUser,
            amount,
            transactionId,
            ipAddress,
            walletFound
          );
          res.status(200).send("Callback processed successfully");
        } else if (
          Status.toLowerCase() === "success" &&
          findBBPSRecord.status.toLowerCase() === "pending"
        ) {
          await saveLog(
            `BILL_PAYMENT`,
            `${findRecord.provider == "Billhub"
              ? "https://api.billhub.in/reseller/recharge"
              : "https://business.a1topup.com/recharge/api"
            }`,
            "https://production-api.google.info/api/wallet/callback",
            req.body || req.query,
            `Recharge Callback Status Update : ${Status} for TxnID: ${TransID}`
          );
          if (findBBPSRecord.operator === "GLF") {
            await BBPS.findOneAndUpdate(
              {
                transactionId: TransID,
              },
              { $set: { status: Status, operatorRef: req.query.opid } }
            );

            // cashback Amount to User Wallet
            const FindUser = userFound;
            const cashbackPercent = percent;
            const txnId = TransID;
            const ipAddress = getIpAddress(req);
            await handleCashback(
              FindUser,
              cashbackPercent,
              txnId,
              ipAddress,
              walletFound
            );
          } else {
            await handleBBPSStatusUpdate(TransID, Status);
            // Send Notificaiton for Success Recharge
            await handleBBPSSendNotification(
              findTxn,
              findBBPSRecord,
              userFound,
              Status
            );
            const FindUser = userFound;
            const cashbackPercent = percent;
            const txnId = TransID;
            const ipAddress = getIpAddress(req);
            await handleCashback(
              FindUser,
              cashbackPercent,
              txnId,
              ipAddress,
              walletFound
            );
          }

          res.status(200).send("Callback processed successfully");
        } else {
          return res.status(400).json({ error: "No Valid Action" });
        }
      } else {
        const findDTHRecord = await DTH.findOne({
          transactionId: TransID,
        });

        if (findDTHRecord) {
          const findTxn = await Transaction.findOne({
            txnId: findDTHRecord.transactionId,
            userId: findDTHRecord.userId,
          });
          const findService = await Service.findById(findTxn?.serviceId);
          const userFound = await User.findById(findDTHRecord.userId);
          const walletFound = await Wallet.findOne({ userId: userFound._id });
          const percent = (findTxn.txnAmount / 100) * findService.percent;
          if (
            (Status.toLowerCase() === "failed" ||
              Status.toLowerCase() === "failure") &&
            findDTHRecord.status.toLowerCase() === "pending"
          ) {
            await handleDTHStatusUpdate(TransID, Status);
            // Send Notificaiton for Failed Recharge
            await handleDTHSendNotification(
              findTxn,
              findDTHRecord,
              userFound,
              Status
            );

            const FindUser = userFound;
            const amount = findTxn.txnAmount;
            const transactionId = TransID;
            const ipAddress = getIpAddress(req);

            await handleRefund(
              FindUser,
              amount,
              transactionId,
              ipAddress,
              walletFound
            );
            res.status(200).send("Callback processed successfully");
          } else if (
            Status.toLowerCase() === "success" &&
            findDTHRecord.status.toLowerCase() === "pending"
          ) {
            await handleDTHStatusUpdate(TransID, Status);
            // Send Notificaiton for Success Recharge
            await handleBBPSSendNotification(
              findTxn,
              findBBPSRecord,
              userFound,
              Status
            );
            const FindUser = userFound;
            const cashbackPercent = percent;
            const txnId = TransID;
            const ipAddress = getIpAddress(req);
            await handleCashback(
              FindUser,
              cashbackPercent,
              txnId,
              ipAddress,
              walletFound
            );

            res.status(200).send("Callback processed successfully");
          } else {
            return res.status(400).json({ error: "No Valid Action" });
          }
        }

        return res.status(400).json({ error: "invalid TxnID" });
      }
    }
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});


const Get_Recharge_Operator_Percent = asyncHandler(async (req, res) => {
  try {
    const findOperator = await RechargeOperator.findOne();
    res.status(200).send(findOperator);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

const Recharge_Status_Verify = asyncHandler(async (req, res) => {
  try {
    const { order_id } = req.query;
    try {
      // const URL = `https://api.billhub.in/reseller/status/?token=${process.env.BILLHUB_TOKEN}&order_id=${order_id}`;
      console.log("order id", order_id);
      const URL = `https://api.techember.in/app/check-status.php?token=${process.env.BILLHUB_TOKEN}&order_id=${order_id}`;
      await saveLog(
        "MOBILE_RECHARGE_STATUS",
        "https://api.techember.in/app/check-status.php",
        URL, // or full request payload
        null,
        `Recharge Status initiated for TxnID: ${order_id}`
      );

      const response = await axios.get(URL);
      console.log("row response", response.data);
      await saveLog(
        "MOBILE_RECHARGE_STATUS",
        "https://api.techember.in/app/check-status.php",
        URL, // or full request payload
        response.data,
        `Recharge Status Response for TxnID: ${order_id}, Status : ${response.data.status}`
      );

      if (!response.data || !response.data.status) {
        res.status(400);
        throw new Error("Failed to fetch status from billhub.");
      }

      const payload = {
        order_id: order_id,
        status: response.data.status,
      };

      const resP = await axios.post(
        `https://api.new.techember.in/api/wallet/callback`,
        payload,
        { headers: { "Content-Type": "application/json" } }
      );
      res.status(200).json({ message: resP.data });
    } catch (error) {
      if (
        error.response &&
        error.response.status === 404 &&
        error.response.data.message == "Transaction does not exist"
      ) {
        const payload = {
          order_id: order_id,
          status: "failed",
        };

        const resP = await axios.post(
          `https://api.new.techember.in/api/wallet/callback`,
          payload,
          { headers: { "Content-Type": "application/json" } }
        );
        res.status(200).json({ message: resP.data });
      } else {
        res.status(400);
        throw new Error(error.message);
      }
    }
  } catch (error) {
    res.status(400);
    throw new Error(error);
  }
});

const Recharge_All_Status_Verify = asyncHandler(async (req, res) => {
  try {
    // Fetch all pending records from the database
    const pendingRecords = await Recharge.find({ status: "pending" });

    if (!pendingRecords.length) {
      return res.status(200).json({ message: "No pending records found." });
    }

    // Process each record based on the provider
    const results = await Promise.allSettled(
      pendingRecords.map(async (record) => {
        try {
          let apiResponse;

          // Determine the API to call based on the provider
          if (record.provider.toLowerCase() === "billhub") {
            try {
              apiResponse = await axios.get(
                `https://api.billhub.in/reseller/status/?token=${process.env.BILLHUB_TOKEN}&order_id=${record.transactionId}`
              );

              if (!apiResponse.data || !apiResponse.data.status) {
                res.status(400);
                throw new Error("Failed to fetch status from a1topup.");
              }

              const payload = {
                order_id: record.transactionId,
                status: apiResponse.data.status?.toLowerCase(),
              };

              const resP = await axios.post(
                `https://production-api.google.info/api/wallet/callback`,
                payload,
                { headers: { "Content-Type": "application/json" } }
              );
              res.status(200).json({ message: resP.data });
            } catch (error) {
              if (
                error.response &&
                error.response.status === 404 &&
                error.response.data.message == "Transaction does not exist"
              ) {
                const payload = {
                  order_id: order_id,
                  status: "failed",
                };

                const resP = await axios.post(
                  `https://production-api.google.info/api/wallet/callback`,
                  payload,
                  { headers: { "Content-Type": "application/json" } }
                );
                res.status(200).json({ message: resP.data });
              } else {
                res.status(400);
                throw new Error(error.message);
              }
            }
          } else if (
            record.provider.toLowerCase() === "a1topup" ||
            record.provider.toLowerCase() === "a1 topup"
          ) {
            apiResponse = await axios.get(
              `https://business.a1topup.com/recharge/status?username=${process.env.A1_TOPUP_USERNAME}&pwd=123&orderid=${record.transactionId}&format=json`
            );

            if (!apiResponse.data || !apiResponse.data.status) {
              res.status(400);
              throw new Error("Failed to fetch status from a1topup.");
            }

            try {
              const payload = {
                order_id: record.transactionId,
                status: apiResponse.data.status?.toLowerCase(),
              };

              const resP = await axios.post(
                `https://production-api.google.info/api/wallet/callback`,
                payload,
                { headers: { "Content-Type": "application/json" } }
              );
              res.status(200).json({ message: resP.data });
            } catch (error) {
              res.status(400);
              throw new Error(error.message);
            }
          } else {
            throw new Error(`Unknown provider: ${record.provider}`);
          }

          // Update record status
          record.status = apiResponse.data.status;
          await record.save();

          return { recordId: record.id, status: "success" };
        } catch (error) {
          console.error(`Error verifying record ${record.id}:`, error.message);
          return {
            recordId: record.id,
            status: "failed",
            error: error.message,
          };
        }
      })
    );

    return res
      .status(200)
      .json({ message: "Verification completed.", results });
  } catch (error) {
    console.error("Error processing pending records:", error.message);
    res.status(500).json({
      message: "Failed to verify pending records.",
      error: error.message,
    });
  }
});

const Update_Recharge_Commission = asyncHandler(async (req, res) => {
  const { percentages } = req.body;

  // Validate the input
  if (!percentages || typeof percentages !== "object") {
    res.status(400);
    throw new Error("Percentages object is required.");
  }

  // Prepare allowed operators
  const allowedOperators = ["airtel", "vi", "jio", "bsnl"];
  const updateFields = {};

  // Validate and filter the input
  for (const [operator, percentage] of Object.entries(percentages)) {
    if (!allowedOperators.includes(operator)) {
      res.status(400);
      throw new Error(`Invalid operator: ${operator}`);
    }
    updateFields[operator] = percentage;
  }

  if (Object.keys(updateFields).length === 0) {
    res.status(400);
    throw new Error("No valid operators provided for update.");
  }

  // Perform the update
  const result = await RechargeOperator.updateMany({}, { $set: updateFields });

  if (result.matchedCount === 0) {
    res.status(404);
    throw new Error("No RechargeOperator records found.");
  }

  res.status(200).json({
    message: "Operator percentages updated successfully",
  });
});

const CHECK_STATUS_API = async (apiTransID, provider) => {
  // Call actual API here

  if (provider === "Billhub") {
    try {
      const URL = `https://api.billhub.in/reseller/status/?token=${process.env.BILLHUB_TOKEN}&order_id=${apiTransID}`;

      const response = await axios.get(URL);

      if (!response.data || !response.data.status) {
        throw new Error("Failed to fetch status from billhub.");
      }

      return {
        status: response.data.status?.toLowerCase(), // or "FAILED", or "PENDING"
        operatorRef: response.data.operatorrefno, // optional
      };
    } catch (error) {
      throw new Error(error.message);
    }
  } else if (provider === "A1Topup") {
    try {
      const URL = `https://business.a1topup.com/recharge/status?username=${process.env.A1_TOPUP_USERNAME}&pwd=123&orderid=${apiTransID}&format=json`;

      const response = await axios.get(URL);

      if (!response.data || !response.data.status) {
        throw new Error("Failed to fetch status from a1topup.");
      }

      return {
        status: response.data.status?.toLowerCase(), // or "FAILED", or "PENDING"
        operatorRef: response.data.operatorrefno, // optional
      };
    } catch (error) {
      throw new Error(error.message);
    }
  } else if (provider === "Mobikwik") {
    // console.log("Mobikwik Called");
    try {
      const URL = `https://${process.env.MOBIKWIK_HOSTNAME}/rechargeStatus.do?uid=${process.env.MOBIKWIK_UID}&pwd=${process.env.MOBIKWIK_PASSWORD}&txId=${apiTransID}`;

      const Mobiresponse = await axios.get(URL);

      const response = await parseXMLToJSON(Mobiresponse.data, "txStatus");
      // console.log(response, "response");

      const status =
        (response.status === "RECHARGESUCCESSPENDING" && "pending") ||
        (response.status === "RECHARGESUCCESS" && "success") ||
        (response.status === "RECHARGEFAILURE" && "failed");
      return {
        status: status, // or "FAILED", or "PENDING"
        operatorRef: response.operatorrefno, // optional
      };
    } catch (error) {
      res.status(400);
      throw new Error(error.message);
    }
  }
};

const CHECK_PENDING_TRANSACTION = async () => {
  const fiveMinsAgo = moment().subtract(5, "minutes").toDate();

  const collections = [
    { model: Recharge, name: "Recharge" },
    { model: DTH, name: "DTH" },
    { model: BBPS, name: "BBPS" },
  ];

  for (const { model, name } of collections) {
    try {
      const pendingRecords = await model.find({
        status: "pending",
        $or: [{ lastCheckedAt: null }, { lastCheckedAt: { $lt: fiveMinsAgo } }],
      });

      for (const record of pendingRecords) {
        // console.log(record, "record");
        const response = await CHECK_STATUS_API(
          record.apiTransID,
          record.provider
        );

        await model.findByIdAndUpdate(record._id, {
          status: response.status,
          operatorRef: response.operatorRef || record.operatorRef,
          lastCheckedAt: new Date(),
        });
      }

      // console.log(`[${name}] Checked ${pendingRecords.length} pending records`);
    } catch (error) {
      console.error(`[${name}] Error:`, error.message);
    }
  }
};

const DTHOperatorArr = [
  {
    OperatorCode: "DTV",
    OperatorName: "Dish TV",
  },
  {
    OperatorCode: "TTV",
    OperatorName: "Tata Sky",
  },
  {
    OperatorCode: "VTV",
    OperatorName: "Videocon DTH",
  },
  {
    OperatorCode: "STV",
    OperatorName: "Sun Direct",
  },
  {
    OperatorCode: "ATV",
    OperatorName: "Airtel Digital TV",
  },
];

const userReferralList = asyncHandler(async (req, res) => {
  const { _id } = req.data;
  const user = await User.findById(_id).select("referalId");
  if (!user) {
    res.status(404);
    throw new Error("Unable to find user");
  }
  const refUser = await User.find({ referedBy: user.referalId });
  successHandler(req, res, {
    Remark: "User Referral List Fetched Successfully",
    Data: refUser.length ? refUser : [],
  })
})


const circles = [
  { id: 1, name: "DELHI", circleCode: "10" },
  { id: 2, name: "UP(West)", circleCode: "97" },
  { id: 3, name: "PUNJAB", circleCode: "02" },
  { id: 4, name: "HP", circleCode: "03" },
  { id: 5, name: "HARYANA", circleCode: "96" },
  { id: 6, name: "J&K", circleCode: "55" },
  { id: 7, name: "UP(East)", circleCode: "54" },
  { id: 8, name: "MUMBAI", circleCode: "92" },
  { id: 9, name: "MAHARASHTRA", circleCode: "90" },
  { id: 10, name: "GUJARAT", circleCode: "98" },
  { id: 11, name: "MP", circleCode: "93" },
  { id: 12, name: "RAJASTHAN", circleCode: "70" },
  { id: 13, name: "KOLKATTA", circleCode: "31" },
  { id: 14, name: "West Bengal", circleCode: "51" },
  { id: 15, name: "ORISSA", circleCode: "53" },
  { id: 16, name: "ASSAM", circleCode: "56" },
  { id: 17, name: "NESA", circleCode: "16" },
  { id: 18, name: "BIHAR", circleCode: "52" },
  { id: 19, name: "KARNATAKA", circleCode: "06" },
  { id: 20, name: "CHENNAI", circleCode: "40" },
  { id: 21, name: "TAMIL NADU", circleCode: "94" },
  { id: 22, name: "KERALA", circleCode: "95" },
  { id: 23, name: "AP", circleCode: "49" },
  { id: 24, name: "SIKKIM", circleCode: "99" },
  { id: 25, name: "TRIPURA", circleCode: "100" },
  { id: 26, name: "CHHATISGARH", circleCode: "101" },
  { id: 27, name: "GOA", circleCode: "102" },
  { id: 28, name: "MEGHALAY", circleCode: "103" },
  { id: 29, name: "MIZZORAM", circleCode: "104" },
  { id: 30, name: "JHARKHAND", circleCode: "105" }
];

const operators = [
  { id: 1, name: "Jio", operatorCode: 11,
    icon: "/uploads/operator/jio.jpg"
   },
  { id: 2, name: "Airtel", operatorCode: 2 ,
    icon: "/uploads/operator/airtel.jpg"
  },
  { id: 3, name: "VI", operatorCode: 23,
    icon: "/uploads/operator/vi.jpg"
   },
  { id: 4, name: "BSNL", operatorCode: 4,
    icon: "/uploads/operator/bsnl.jpg"
   },
];

const getCircleAndOperators = asyncHandler(async (req, res) => {
  successHandler(req, res, {
    Remarks: "Circle & Operator List",
    Data: {
      circles,
      operators
    }
  });
});




module.exports = {
  planFetch, //-----------------------------
  userReferralList,
  //   getOperator, //-----------------------------
  //   getCircle, //-----------------------------
  //   getBalance, //-----------------------------
  rechargeRequest, //-----------------------------
  //   rechargeStatus, //-----------------------------
  //   dthInfoFetch, //-----------------------------
  fetchDthPlans,
  fetchDthOperator,
  rechargeHistory,
  dthRequest,
  dthHistory,
  handleFailedRecharge,
  rechargeHistoryByAdmin,
  dthHistoryByAdmin,
  Recharge_CallBack_Handler, // isko karna hai
  Get_Operator_Circle_By_Phone, //-----------------------------
  Get_Recharge_Operator_Percent,
  BillhubComplainRaise,
  Recharge_Status_Verify,
  Recharge_All_Status_Verify,
  Update_Recharge_Commission,
  CHECK_PENDING_TRANSACTION,
  rechargeStatus,
  fetchDthOperators,
  commission,
  fetchDthOpDetails,
  getCircleAndOperators,
};

// 
