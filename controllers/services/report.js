const asyncHandler = require("express-async-handler");
const Recharge = require("../../models/service/rechargeSchema");
const DTH = require("../../models/service/dthSchema");
const BBPS = require("../../models/service/bbps");
const successHandler = require("../../common/successHandler");

const {
  All_Recharge_Operator_List,
  All_DTH_Recharge_Operator_List
} = require("../../utils/MockData");

// 🔍 Helper to get Operator Name
const getOperatorName = (operatorCode) => {
  console.log("Looking up operator name for code:", operatorCode);
  if (!operatorCode) return null;
  const matched = All_Recharge_Operator_List.find(
    (x) => String(x.PlanApi_Operator_code) === String(operatorCode)
  );

  return matched ? matched.Operator_name : null;
};



// 🔍 Helper to get Operator Name
const getDthOperatorName = (operatorCode) => {
  console.log("Looking up operator name for code:", operatorCode);
  if (!operatorCode) return null;
  const matched = All_DTH_Recharge_Operator_List.find(
    (x) => String(x.planApi_operator_code) === String(operatorCode)
  );
  return matched ? matched.Operator_name : null;
};

const combinedHistory = asyncHandler(async (req, res) => {
  const { _id } = req.data;

  const {
    serviceType, // recharge | dth | bbps | all
    serviceId,
    startDate,
    endDate,
    number,
    transactionId,
    amount,
  } = req.query;

  try {
    // ---------------- DATE FILTER ----------------
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.createdAt.$lte = end;
      }
    }

    // ---------------- BASE FILTER ----------------
    const baseFilter = {
      userId: _id,
      ...dateFilter,
    };

    if (serviceId) baseFilter.serviceId = serviceId;
    if (number) baseFilter.number = number;
    if (transactionId) baseFilter.transactionId = transactionId;
    if (amount) baseFilter.amount = Number(amount);

    // ---------------- DATA HOLDERS ----------------
    let dthData = [];
    let rechargeData = [];
    let bbpsData = [];

    const promises = [];

if (!serviceType || serviceType === "dth" || serviceType === "all") {
  promises.push(
    DTH.find(baseFilter)
      .sort({ createdAt: -1 })
      .lean()
      .then((data) => {
        dthData = (data || []).map((item) => {
          console.log("DTH Item:", item.operator); // ⭐ Print each item

          return {
            ...item,
            operatorName: getDthOperatorName(item.operator),
          };
        });
      })
  );
}

    // ---------------- Recharge ----------------
    if (!serviceType || serviceType === "recharge" || serviceType === "all") {
      promises.push(
        Recharge.find(baseFilter)
          .sort({ createdAt: -1 })
          .lean()
          .then((data) => {
            rechargeData = (data || []).map((item) => ({
              ...item,
              operatorName: getOperatorName(item.operator), // ⭐ Add operator name
            }));
          })
      );
    }

    // ---------------- BBPS ----------------
    if (!serviceType || serviceType === "bbps" || serviceType === "all") {
      promises.push(
        BBPS.find(baseFilter)
          .sort({ createdAt: -1 })
          .lean()
          .then((data) => {
            bbpsData = data || [];
          })
      );
    }

    await Promise.all(promises);

    // ---------------- FINAL RESPONSE ----------------
    const finalData = {
      dth: dthData,
      mobile: rechargeData,
      bbps: bbpsData,
    };

    successHandler(req, res, {
      Remarks: "User Combined Recharge History",
      Data: finalData,
    });
  } catch (error) {
    console.error("[COMBINED_HISTORY_ERROR]", error);
    res.status(500).json({
      Error: true,
      Status: false,
      ResponseStatus: 0,
      StatusCode: "Ex500",
      Remarks: "An error occurred while fetching combined recharge history.",
    });
  }
});

module.exports = { combinedHistory };
