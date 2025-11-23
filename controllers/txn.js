const Txn = require("../models/txnSchema");
const asyncHandler = require("express-async-handler");
const successHandler = require("../common/successHandler");
// const { encryptFunc } = require("../common/encryptDecrypt");
const Users = require("../models/userSchema");
const { error } = require("winston");
// const { all } = require("axios");
const rechargeSchema = require("../models/service/rechargeSchema");
const dthSchema = require("../models/service/dthSchema");
const bbps = require("../models/service/bbps");
const txnSchema = require("../models/txnSchema");
const {
  All_Recharge_Circle_List,
  All_Recharge_Operator_List,
  ALL_DTH_Operator_List,
  All_DTH_Recharge_Operator_List,
} = require("../utils/MockData");
const moment = require("moment");
const serviceSchema = require("../models/serviceSchema");
const userSchema = require("../models/userSchema");

// txn list by User
const getTransaction = asyncHandler(async (req, res) => {
  try {
    const bills = [
      "Electricity",
      "FasTag",
      "Landline",
      "LPG",
      "Education Fee",
      "Loan Repay",
      "Credit Card",
      "Housing",
      "Hospital Bills",
      "Subscription",
      "Club Assoc",
      "Tax",
      "Municipal Ser",
      "Insurance",
    ];

    const { _id } = req.data;

    // Extract all possible filters
    const {
      txnResource,
      txnType,
      txnName,
      status,
      search,
      fromDate,
      toDate,
      page = 1,
      limit = 20,
    } = req.query;

    // Base filter
    const filter = { userId: _id };

    // Apply optional filters (only if provided)
    if (txnResource) filter.txnResource = txnResource;

    if (txnType) filter.txnType = txnType; // debit / credit

    allTxn = await Txn.find({ userId: _id }).populate("recipientId");
    const allTxnResource = allTxn.map((item) => item.txnName);
    console.log("req.query", allTxnResource);

    if (status) filter.status = status; // success / failed / pending

    if (txnName) {
      filter.txnName =
        txnName === "Bills" ? { $in: bills } : txnName;
    }

    // Search filter (on amount, reference, recipient name, etc.)
    if (search) {
      filter.$or = [
        { amount: { $regex: search, $options: "i" } },
        { referenceId: { $regex: search, $options: "i" } },
        { "recipientName": { $regex: search, $options: "i" } },
      ];
    }

    // Date range filter
    if (fromDate || toDate) {
      filter.createdAt = {};
      if (fromDate) filter.createdAt.$gte = new Date(fromDate);
      if (toDate) filter.createdAt.$lte = new Date(toDate);
    }

    // Pagination
    const skip = (page - 1) * limit;

    // Fetch data
    const transactions = await Txn.find(filter)
      .populate("recipientId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Txn.countDocuments(filter);

    successHandler(req, res, {
      Remarks: "Filtered transaction list",
      Data: {
        total,
        page: Number(page),
        limit: Number(limit),
        transactions,
      },
    });
  } catch (err) {
    res.status(500).json({
      Error: true,
      Status: false,
      ResponseStatus: 0,
      StatusCode: "Ex500",
      Remarks: err.message || "Something went wrong",
    });
  }
});



// txn list by Admin
// const getAllTransaction = asyncHandler(async (req, res) => {
//   const page = parseInt(req.body.pageNumber) || 1; // Default page number is 1
//   const pageSize = parseInt(req.body.pageSize) || 20; // Default page size is 20
//   const searchVal = req.body.search || "";
//   const selectVal = req.body.select || "";
//   const startDate = new Date(req.body.startDate) || "";
//   const endDate = new Date(req.body.endDate) || "";
//   const activeTab = req.body.activeTab || "";

//   let allTxn;
//   let LastPage;
//   // Check if there is a search value and a select value
//   if (
//     searchVal ||
//     selectVal ||
//     req.body.startDate ||
//     req.body.endDate ||
//     activeTab
//   ) {
//     if (
//       selectVal === "phone" ||
//       selectVal === "email" ||
//       selectVal === "txnId" ||
//       selectVal === "_id"
//     ) {
//       if (selectVal !== "txnId") {
//         const FindUser = await Users.findOne({ [selectVal]: searchVal });
//         if (FindUser) {
//           allTxn = await Txn.find({ userId: FindUser._id })
//             .sort({ createdAt: -1 })
//             .skip((page - 1) * pageSize)
//             .limit(pageSize)
//             .populate("userId")
//             .populate("recipientId");
//           LastPage = Math.ceil(
//             (await Txn.countDocuments({ userId: FindUser._id })) / pageSize
//           );
//         } else {
//           res.status(400);
//           throw new Error(`${selectVal} - ${searchVal} is Incorrect`);
//         }
//       } else {
//         allTxn = await Txn.find({ [selectVal]: searchVal })
//           .sort({ createdAt: -1 })
//           .skip((page - 1) * pageSize)
//           .limit(pageSize)
//           .populate("userId")
//           .populate("recipientId");
//         LastPage = Math.ceil(
//           (await Txn.countDocuments({ [selectVal]: searchVal })) / pageSize
//         );
//       }
//     } else if (startDate && endDate && !activeTab) {
//       allTxn = await Txn.find({
//         createdAt: {
//           $gte: startDate,
//           $lte: endDate,
//         },
//       })
//         .sort({ createdAt: -1 })
//         .skip((page - 1) * pageSize)
//         .limit(pageSize)
//         .populate("userId")
//         .populate("recipientId");
//       LastPage = Math.ceil((await Txn.countDocuments()) / pageSize);
//     } else if (activeTab) {
//       if (activeTab === "All") {
//         allTxn = await Txn.find()
//           .sort({ createdAt: -1 })
//           .skip((page - 1) * pageSize)
//           .limit(pageSize)
//           .populate("userId")
//           .populate("recipientId");
//         LastPage = Math.ceil((await Txn.countDocuments()) / pageSize);
//       } else {
//         allTxn = await Txn.find({ txnResource: activeTab })
//           .sort({ createdAt: -1 })
//           .skip((page - 1) * pageSize)
//           .limit(pageSize)
//           .populate("userId")
//           .populate("recipientId");
//         LastPage = Math.ceil((await Txn.countDocuments()) / pageSize);
//       }
//     }
//   } else {
//     allTxn = await Txn.find()
//       .sort({ createdAt: -1 })
//       .skip((page - 1) * pageSize)
//       .limit(pageSize)
//       .populate("userId")
//       .populate("recipientId");
//     LastPage = Math.ceil((await Txn.countDocuments()) / pageSize);
//   }

//   // success handler
//   successHandler(req, res, {
//     Remarks: "Fetch all transaction",
//     Data: {
//       data: allTxn,
//       lastPage: LastPage,
//     },
//   });
// });
const getAllTransaction = asyncHandler(async (req, res) => {
  const page = parseInt(req.body.pageNumber) || 1;
  const pageSize = parseInt(req.body.pageSize) || 20;
  const searchVal = req.body.search || "";
  const selectVal = req.body.select || "";
  const startDate = req.body.startDate ? new Date(req.body.startDate) : null;
  const endDate = req.body.endDate ? new Date(req.body.endDate) : null;
  const activeTab = req.body.activeTab || "";

  // Build the query object
  const query = {};

  // Add filters to the query object
  if (searchVal && selectVal) {
    if (["phone", "email", "txnId", "_id"].includes(selectVal)) {
      if (selectVal !== "txnId") {
        const user = await Users.findOne({ [selectVal]: searchVal });
        if (!user) {
          res
            .status(400)
            .json({ error: `${selectVal} - ${searchVal} is Incorrect` });
          return;
        }
        query.userId = user._id;
      } else {
        query[selectVal] = searchVal;
      }
    }
  }

  if (startDate && endDate) {
    query.createdAt = { $gte: startDate, $lte: endDate };
  }

  if (activeTab && activeTab !== "All") {
    query.txnResource = activeTab;
  }

  // Fetch transactions with pagination, sorting, and population
  const [allTxn, totalDocuments] = await Promise.all([
    Txn.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .populate("userId", "firstName lastName email phone")
      .populate("recipientId", "firstName lastName email phone"),
    Txn.countDocuments(query),
  ]);

  const lastPage = Math.ceil(totalDocuments / pageSize);

  // Return success response
  successHandler(req, res, {
    Remarks: "Fetch all transactions",
    Data: {
      data: allTxn,
      lastPage,
    },
  });
});

// txn by specific user   --- pending
const txnByUserId = asyncHandler(async (req, res) => {
  const { _id } = req.data;
  const { receiverId } = req.params;

  const sender = await Txn.find({
    recipientId: _id,
    userId: receiverId,
    txnResource: "Wallet",
  }).select("-__v -gatewayName -ipAddress");

  const receiver = await Txn.find({
    recipientId: receiverId,
    userId: _id,
    txnResource: "Wallet",
  });

  // Step-1: Merge + Sort
  let txns = [...sender, ...receiver].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
  );

  // Step-2: Add balances
  let currentBalance = 0;

  txns = txns.map((txn) => {
    const amount = Number(txn.txnAmount) || 0;
    const openingBalance = currentBalance;

    if (txn.txnType === "credit") {
      currentBalance += amount;
    } else if (txn.txnType === "debit") {
      currentBalance -= amount;
    }

    const closingBalance = currentBalance;

    return {
      ...txn._doc,
      openingBalance: openingBalance.toFixed(2),
      closingBalance: closingBalance.toFixed(2),
    };
  });

  // Step-3: Reverse if you want recent first
  txns.reverse();

  successHandler(req, res, {
    Remarks: "Fetch txn list by user.",
    Data: txns,
  });
});

// const GET_LEDGER_REPORT_USER = asyncHandler(async (req, res) => {
//   const { userId } = req.query;
//   if (!userId) {
//     res.status(400);
//     throw new error("Parameter is Missing");
//   }
//   try {
//           const user = await userSchema.findById(userId).select("firstName lastName");
//     const fullName = `${user.firstName.trim()} ${user.lastName.trim()}`;

//     if (!user) {
//       res.status(404);
//       throw new Error("User not found");
//     }
//     // Step 1: Fetch Wallet Transactions
//     const walletTransactions = await Txn.find({ userId });

//     // Step 2: Fetch Service-Specific Transactions
//     const rechargeTransactions = await rechargeSchema.find({ userId });
//     const dthTransactions = await dthSchema.find({ userId });
//     const bbpsTransactions = await bbps.find({ userId });

//     // Step 3: Combine All Transactions
//     let allTransactions = [];

//     // Handle Wallet Transactions (Avoid Duplicates)
//     walletTransactions.forEach((txn) => {
//       // console.log(txn, "txn");
//       let description = txn.txnDesc;
//       // if (txn.txnResource === "Online") description = "Wallet_Topup";
//       // if (txn.txnId.endsWith("cashback")) description = "Cashback";
//       // if (txn.txnId.endsWith("refer")) description = "Refer_Bonus";
//       // if (txn.txnId.endsWith("refund")) description = "Refund";

//       // Avoid duplicate entry based on txnId
//       if (!allTransactions.some((t) => t.orderId === txn.txnId)) {
//         allTransactions.push({
//           orderId: txn.txnId,
//           description,
//           type: txn.txnType, // credit/debit
//           amount: txn.txnAmount,
//           linkedOrderId: txn.txnId.endsWith("cashback")
//             ? txn.txnId.replace("cashback", "")
//             : txn.txnId.endsWith("refer")
//             ? txn.txnId.replace("refer", "")
//             : txn.txnId.endsWith("refund")
//             ? txn.txnId.replace("refund", "")
//             : null,
//           status: txn.txnStatus,
//           date: txn.createdAt,
//         });
//       }
//     });

//     // Handle Recharge Transactions (Add Service Remarks and Avoid Duplicates)
//     rechargeTransactions.forEach((txn) => {
//       const existingTxn = allTransactions.find(
//         (t) => t.orderId === txn.transactionId
//       );
//       if (!existingTxn) {
//         allTransactions.push({
//           orderId: txn.transactionId,
//           description: `Recharge (${txn.operator})`,
//           type: "debit",
//           amount: txn.amount,
//           linkedOrderId: null,
//           status: txn.status,
//           date: txn.createdAt,
//         });
//       }
//     });

//     // Handle BBPS Transactions (Add Service Remarks and Avoid Duplicates)
//     bbpsTransactions.forEach((txn) => {
//       const existingTxn = allTransactions.find(
//         (t) => t.orderId === txn.transactionId
//       );
//       if (!existingTxn) {
//         allTransactions.push({
//           orderId: txn.transactionId,
//           description: `BBPS Payment to ${txn.operator}`,
//           type: "debit",
//           amount: txn.amount,
//           linkedOrderId: null,
//           status: txn.status,
//           date: txn.createdAt,
//         });
//       }
//     });

//     // Handle DTH Transactions (Add Service Remarks and Avoid Duplicates)
//     dthTransactions.forEach((txn) => {
//       const existingTxn = allTransactions.find(
//         (t) => t.orderId === txn.transactionId
//       );
//       if (!existingTxn) {
//         allTransactions.push({
//           orderId: txn.transactionId,
//           description: `DTH Recharge to ${txn.operator}`,
//           type: "debit",
//           amount: txn.amount,
//           linkedOrderId: null,
//           status: txn.status,
//           date: txn.createdAt,
//         });
//       }
//     });

//     // Step 4: Sort Transactions by Date
//     allTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));

//     // Step 5: Calculate Opening and Closing Balances
//     let openingBalance = 0;
//     const ledger = allTransactions.map((txn) => {
//       const closingBalance =
//         txn.type === "credit"
//           ? openingBalance + txn.amount
//           : openingBalance - txn.amount;

//       const ledgerEntry = {
//         orderId: txn.orderId,
//         description: txn.description,
//         debit: txn.type === "debit" ? txn.amount : 0,
//         credit: txn.type === "credit" ? txn.amount : 0,
//         openingBalance: openingBalance.toFixed(2),
//         closingBalance: closingBalance.toFixed(2),
//         date: txn.date,
//         userName: fullName, // Add User Name in Ledger
//       };

//       openingBalance = closingBalance;
//       return ledgerEntry;
//     });
//     successHandler(req, res, {
//       Remarks: "Ledger Generate Successfully",
//       Data: ledger,
//     });

//   } catch (error) {
//     console.error("Error generating ledger:", error);
//     throw new Error("Failed to generate ledger.");
//   }
// });\

const GET_LEDGER_REPORT_USER = asyncHandler(async (req, res) => {
  const { phone, startDate, endDate } = req.query;
  if (!phone) {
    res.status(400);
    throw new Error("Parameter is Missing");
  }
  try {
    const user = await userSchema
      .findOne({ phone: phone })
      .select("firstName lastName");
    console.log(user, "user");
    const fullName = `${user.firstName.trim()} ${user.lastName.trim()}`;

    if (!user) {
      res.status(404);
      throw new Error("User not found");
    }

    // ✨ Date Filter (Optional)
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        },
      };
    }

    // Step 1: Fetch Wallet Transactions
    const walletTransactions = await Txn.find({
      userId: user._id,
      ...dateFilter,
    });

    // Step 2: Fetch Service-Specific Transactions
    const rechargeTransactions = await rechargeSchema.find({
      userId: user._id,
      ...dateFilter,
    });
    const dthTransactions = await dthSchema.find({
      userId: user._id,
      ...dateFilter,
    });
    const bbpsTransactions = await bbps.find({
      userId: user._id,
      ...dateFilter,
    });

    // Step 3: Combine All Transactions
    let allTransactions = [];

    console.log(walletTransactions, "walletTransactions");
    // Handle Wallet Transactions (Avoid Duplicates)
    walletTransactions.forEach((txn) => {
      let description = txn.txnDesc;
      // Avoid duplicate entry based on txnId
      // console.log(txn.txnId, "txn.txnId");
      if (!allTransactions.some((t) => t.orderId === txn.txnId)) {
        const findRecharge = rechargeTransactions.find(
          (a) => a.transactionId == txn.txnId
        );
        const findDTH = dthTransactions.find(
          (a) => a.transactionId == txn.txnId
        );
        const findBBPS = bbpsTransactions.find(
          (a) => a.transactionId == txn.txnId
        );
        console.log("findRecharge 3",findRecharge);
        if (findRecharge) {
          const findOpr = All_Recharge_Operator_List.find(
            (b) =>
              b.PlanApi_Operator_code == findRecharge.operator ||
              b.A1_Operator_code == findRecharge.operator ||
              b.Cyrus_Operator_code == findRecharge.operator ||
              b.Billhub_Operator_code == findRecharge.operator
          );
        
          description = `Mobile Recharge | ${findRecharge.number} | ${findOpr.Operator_name} | TXN_ID ${txn.txnId}`;
          // console.log(dec, "findOpr");
        } else if (findDTH) {
          const findOpr = All_DTH_Recharge_Operator_List.find(
            (b) =>
              b.Billhub_Operator_code == findDTH.operator ||
              b.Mobikwik_Operator_code == findDTH.operator ||
              b.A1_Operator_code == findDTH.operator
          );
          description = `DTH Recharge | ${findDTH.number} | ${findOpr.Operator_name} | TXN_ID ${txn.txnId}`;
        } else if (findBBPS) {
          description = `Bill Payment | ${findBBPS.number} | ${findBBPS.operator} | TXN_ID ${txn.txnId}`;
        } else if (txn.txnId.endsWith("cashback")) {
          description = `${txn.txnDesc} | TXN_ID ${txn.txnId.replace(
            /(cashback)$/,
            ""
          )}`;
        } else if (txn.txnId.endsWith("refund")) {
          description = `${txn.txnDesc} | TXN_ID ${txn.txnId.replace(
            /(refund)$/,
            ""
          )}`;
        } else if (txn.txnDesc == "You have added to wallet.") {
          description = `WALLET_TOPUP`;
        }
        allTransactions.push({
          orderId: txn.txnId,
          description,
          type: txn.txnType, // credit/debit
          amount: txn.txnAmount,
          linkedOrderId: txn.txnId.endsWith("cashback")
            ? txn.txnId.replace("cashback", "")
            : txn.txnId.endsWith("refer")
              ? txn.txnId.replace("refer", "")
              : txn.txnId.endsWith("refund")
                ? txn.txnId.replace("refund", "")
                : null,
          status: txn.txnStatus,
          date: txn.createdAt,
        });
      }
    });

   

    // Handle Recharge Transactions (Add Service Remarks and Avoid Duplicates)
    rechargeTransactions.forEach((txn) => {
      const existingTxn = allTransactions.find(
        (t) => t.orderId === txn.transactionId
      );
      if (!existingTxn) {
        allTransactions.push({
          orderId: txn.transactionId,
          description: `Recharge (${txn.operator})`,
          type: "debit",
          amount: txn.amount,
          linkedOrderId: null,
          status: txn.status,
          date: txn.createdAt,
        });
      }
    });

    // Handle BBPS Transactions (Add Service Remarks and Avoid Duplicates)
    bbpsTransactions.forEach((txn) => {
      const existingTxn = allTransactions.find(
        (t) => t.orderId === txn.transactionId
      );
      if (!existingTxn) {
        allTransactions.push({
          orderId: txn.transactionId,
          description: `BBPS Payment to ${txn.operator}`,
          type: "debit",
          amount: txn.amount,
          linkedOrderId: null,
          status: txn.status,
          date: txn.createdAt,
        });
      }
    });

    // Handle DTH Transactions (Add Service Remarks and Avoid Duplicates)
    dthTransactions.forEach((txn) => {
      const existingTxn = allTransactions.find(
        (t) => t.orderId === txn.transactionId
      );
      if (!existingTxn) {
        allTransactions.push({
          orderId: txn.transactionId,
          description: `DTH Recharge to ${txn.operator}`,
          type: "debit",
          amount: txn.amount,
          linkedOrderId: null,
          status: txn.status,
          date: txn.createdAt,
        });
      }
    });

    // Step 4: Sort Transactions by Date
    allTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Step 5: Calculate Opening and Closing Balances
    let openingBalance = 0;
    const ledger = allTransactions.map((txn) => {
      const closingBalance =
        txn.type === "credit"
          ? openingBalance + txn.amount
          : openingBalance - txn.amount;

      const ledgerEntry = {
        orderId: txn.orderId,
        description: txn.description,
        debit: txn.type === "debit" ? txn.amount : 0,
        credit: txn.type === "credit" ? txn.amount : 0,
        openingBalance: openingBalance.toFixed(2),
        closingBalance: closingBalance.toFixed(2),
        date: txn.date,
        userName: fullName, // Add User Name in Ledger
      };

      openingBalance = closingBalance;
      return ledgerEntry;
    });
    successHandler(req, res, {
      Remarks: "Ledger Generate Successfully",
      Data: ledger,
    });
  } catch (error) {
    console.error("Error generating ledger:", error);
    throw new Error("Failed to generate ledger.");
  }
});

const Generate_Invoice_By_OrderId = asyncHandler(async (req, res) => {
  const { orderId } = req.query;

  // Validate the presence of orderId
  if (!orderId) {
    res.status(400);
    throw new Error("Order ID is Missing");
  }

  try {
    // Fetch all schemas in parallel
    const [txnRecord, rechargeRecord, dthRecord, bbpsRecord] =
      await Promise.all([
        txnSchema
          .findOne({ txnId: orderId })
          .populate("userId", "firstName lastName email phone")
          .lean(),
        rechargeSchema.findOne({ transactionId: orderId }).lean(),
        dthSchema.findOne({ transactionId: orderId }).lean(),
        bbps.findOne({ transactionId: orderId }).lean(),
      ]);

    console.log(dthRecord, "dthRecord");

    let TXN_TYPE = null;
    let CIRCLE = null;
    let OPERATOR = null;
    let DTH_OPERATOR = null;
    let GST_AMOUNT = null;
    let FIND_SERVICE = null;

    if (txnRecord.txnResource !== "Online") {
      const gstAmount = (txnRecord.txnAmount * 18) / (100 + 18);

      // Calculate the amount excluding GST
      const amountExcludingGST = txnRecord.txnAmount - gstAmount;

      GST_AMOUNT = {
        gstAmount: gstAmount.toFixed(2), // GST amount rounded to 2 decimal places
        amountExcludingGST: amountExcludingGST.toFixed(2), // Excluding GST rounded to 2 decimal places
      };
    }

    // Determine the TXN_TYPE based on priority
    if (txnRecord && txnRecord.txnResource === "Online") {
      TXN_TYPE = "ONLINE";
    } else if (rechargeRecord) {
      TXN_TYPE = "RECHARGE";
      CIRCLE = All_Recharge_Circle_List.find(
        (item) => item.planapi_circlecode == rechargeRecord.circle
      );
      OPERATOR = All_Recharge_Operator_List.find(
        (item) => item.PlanApi_Operator_code == rechargeRecord.operator
      );
    } else if (dthRecord) {
      TXN_TYPE = "DTH";
      DTH_OPERATOR = All_DTH_Recharge_Operator_List.find(
        (item) => item.Mobikwik_Operator_code == dthRecord.operator
      );
    } else if (bbpsRecord) {
      TXN_TYPE = "BBPS";

      FIND_SERVICE = await serviceSchema.findOne({ _id: bbpsRecord.serviceId });
    }

    // If no record is found
    if (!TXN_TYPE) {
      res.status(404);
      throw new Error("No record found for the given Order ID");
    }

    const placeOfSupply =
      TXN_TYPE === "RECHARGE"
        ? `
      <div class="mt-5 ">
        <h3 class="font-bold">Place of Supply</h3>
        <p>${rechargeRecord.circle} - ${CIRCLE?.circlename || "N/A"}</p>
      </div>
      `
        : "";
    const Show_Hsn_Code_Key =
      TXN_TYPE !== "ONLINE"
        ? `
      <th class="border border-gray-300 px-4 py-2">HSN Code</th>
      `
        : "";
    const Show_Hsn_Code_Value =
      TXN_TYPE !== "ONLINE"
        ? `
      <td class="border text-center border-gray-300 px-4 py-2">
                  998413
                </td>
      `
        : "";

    const Product_Details =
      TXN_TYPE == "ONLINE"
        ? "E-Topup"
        : TXN_TYPE == "RECHARGE"
          ? `Recharge | ${OPERATOR.Operator_name} | Number - ${rechargeRecord.number}`
          : TXN_TYPE == "DTH"
            ? `DTH Recharge | ${DTH_OPERATOR.Operator_name} | Number - ${dthRecord.number}`
            : `Bill Payment | ${FIND_SERVICE.name} | Number - ${bbpsRecord.number}`;

    const Show_IGST =
      TXN_TYPE !== "ONLINE"
        ? `
        <div class="flex justify-between items-center">
          <p class="font-medium">IGST (18%)</p>
          <p class="">₹${GST_AMOUNT.gstAmount}</p>
        </div>
      `
        : "";

    const Show_BILLHUB =
      TXN_TYPE !== "ONLINE"
        ? `
        <h2 class="text-xl  font-semibold">
            Powered by Billhub
          </h2>
      `
        : "";

    const Invoice_Content = `<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
     <title>${`INVOICE_${orderId}`}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
      @media print {
        @page {
          size: A4 portrait;
          margin: 10mm;
        }
         #printButton {
          display: none;
        }
        body {
          background: none;
        }
      }
      p {
        font-family: monospace;
      }
      th {
        font-family: monospace;
      }
      td {
        font-family: monospace;
      }
      h3 {
        font-family: monospace;
      }
      h2 {
        font-family: monospace;
      }
    </style>
  </head>
  <body class="flex justify-center items-center h-screen bg-gray-100">
    <div class="bg-white h-full h-[3508px] w-[2480px] p-5">
      <div class="border border-gray-300 p-5">
        <!-- Header -->
        <div class="border-b flex justify-between items-center pb-4">
          <h2 class="text-xl  font-semibold">
            Aadyapay
          </h2>
         <!-- ${Show_BILLHUB} -->
        </div>

        <div class="mt-5 flex justify-between border-b pb-5">
          <div>
            <p class="text-gray-700 font-semibold">C/O Manoj Dhakar</p>
            <p class="text-gray-600 font-semibold">Sheel Nagar, Gird</p>
            <p class="text-gray-600 font-semibold">SP Ashram, Madhya Pradesh</p>
            <p class="text-gray-600 font-semibold">474012, India</p>
          </div>
          <div>
            <h3 class="text-base font-bold">Billed To:</h3>
            <p class="text-gray-700 font-semibold">${txnRecord.userId.firstName
      } ${txnRecord.userId.lastName}</p>
            <p class="text-gray-600 font-semibold">${txnRecord.userId.email}</p>
            <p class="text-gray-600 font-semibold">${txnRecord.userId.phone}</p>
          </div>
          
        </div>

        <!-- Invoice Info -->
        <div class="mt-5 flex justify-between border-b pb-5">
          
          <div>
            <h3 class="text-base font-bold">Invoice Details:</h3>
            <p class="text-gray-700 font-semibold">
              Order ID: ${orderId}
            </p>
            <p class="text-gray-600 font-semibold">
              Date: ${moment(txnRecord.createdAt).format("lll")}
            </p>
          </div>
          ${placeOfSupply}
        </div>

        

        <!-- Table -->
        <div class="mt-5">
          <table class="w-full border-collapse border border-gray-300">
            <thead class="bg-gray-200">
              <tr>
                <th class="border border-gray-300 px-4 py-2">
                  Product Details
                </th>
               ${Show_Hsn_Code_Key}
                <th class="border border-gray-300 px-4 py-2">Rate</th>
                <th class="border border-gray-300 px-4 py-2">Qty</th>
                <th class="border border-gray-300 px-4 py-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td
                  class="border break-words text-wrap text-center border-gray-300 px-4 py-2"
                >
                  ${Product_Details}
                </td>
               ${Show_Hsn_Code_Value}
                <td class="border text-center border-gray-300 px-4 py-2">
                  ₹${TXN_TYPE == "ONLINE"
        ? txnRecord.txnAmount
        : GST_AMOUNT.amountExcludingGST
      }
                </td>
                <td class="border text-center border-gray-300 px-4 py-2">1</td>
                <td class="border text-center border-gray-300 px-4 py-2">
                  ₹${TXN_TYPE == "ONLINE"
        ? txnRecord.txnAmount
        : GST_AMOUNT.amountExcludingGST
      }
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Summary -->
        <div class="flex justify-end">
          <div class="mt-8 space-y-3 w-80">
            <div class="flex justify-between items-center">
              <p class="font-medium">Sub Total</p>
              <p class="">₹${TXN_TYPE == "ONLINE"
        ? txnRecord.txnAmount
        : GST_AMOUNT.amountExcludingGST
      }</p>
            </div>
           ${Show_IGST}
            <div class="flex border-t pt-3 justify-between items-center">
              <p class="text-lg font-bold">Total Amount</p>
              <p class="text-lg font-bold">₹${txnRecord.txnAmount}</p>
            </div>
          </div>
        </div>
      </div>
       <div class="mt-5 text-right">
        <button
          id="printButton"
          onclick="window.print()"
          style="
            padding: 10px 20px;
            font-size: 16px;
            background: blue;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
          "
        >
          Print
        </button>
      </div>
       <div class="flex justify-center items-center">
        <p class="absolute bottom-10">
          Note : This is computer generated reciept and does not require
          physical signature.
        </p>
      </div>
    </div>
  </body>
</html>`;
    res.send(Invoice_Content);
  } catch (error) {
    res.status(500);
    throw new Error(error.message || "Internal Server Error");
  }
});

module.exports = {
  getTransaction,
  txnByUserId,
  getAllTransaction,
  GET_LEDGER_REPORT_USER,
  Generate_Invoice_By_OrderId,
};
