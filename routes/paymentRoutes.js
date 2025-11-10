const router = require("express").Router();
const express = require("express");
const bodyParser = require("body-parser");

const { tokenVerify, adminTokenVerify } = require("../common/tokenVerify");
const {
  paywithWallet,
  createOrderId,
  paymentCallback,
  createCashfreeOrderId,
  //   createOneGatewayOrderId,
  cashfreePaymentCallback,
  getCashfreePaymentStatus,
  //   OneGatewayPaymentCallback,
  //   getOneGatewayPaymentStatus,
  createPaygicOrderId,
  PaygicPaymentCallback,
  getPaygicPaymentStatus,
  Create_UPI_Intent_OrderId,
  Common_UPI_Intent_Payment_Callback,
  Common_UPI_Intent_Verify_Status,
  Create_PAYU_Order_ID,
  Get_Recharge_PG_List,
  SELECT_RECHARGE_PG,
} = require("../controllers/payment");

// routes
router.route("/wallet").post(paywithWallet);

// razorpay
router.post("/create-order", tokenVerify, createOrderId);
router.post("/payment-callback", tokenVerify, paymentCallback);

// Payu
router.post("/payu/create-order", tokenVerify, Create_PAYU_Order_ID);

// Cashfree
router.post("/cashfree/create-order", tokenVerify, createCashfreeOrderId);
// router.post("/onegateway/create-order", tokenVerify, createOneGatewayOrderId);
router.post("/paygic/create-order", tokenVerify, createPaygicOrderId);
router.post("/cashfree/verify-order", tokenVerify, getCashfreePaymentStatus);
// router.post(
//   "/onegateway/verify-order",
//   tokenVerify,
//   getOneGatewayPaymentStatus
// );
router.post("/paygic/verify-order", tokenVerify, getPaygicPaymentStatus);
router.post("/cashfree/payment-callback", cashfreePaymentCallback);
// router.post("/onegateway/payment-callback", OneGatewayPaymentCallback);
router.post("/paygic/payment-callback", PaygicPaymentCallback);

// Common UPI OrderID
router.post("/upiintent/create-order", tokenVerify, Create_UPI_Intent_OrderId);
router.post("/upiintent/payment-callback", Common_UPI_Intent_Payment_Callback);
router.post(
  "/upiintent/verify-order",
  tokenVerify,
  Common_UPI_Intent_Verify_Status
);

router.get("/get-recharge-pg-list", tokenVerify, Get_Recharge_PG_List);
router.patch("/select-recharge-pg", adminTokenVerify, SELECT_RECHARGE_PG);
module.exports = router;
