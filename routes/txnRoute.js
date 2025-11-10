const router = require("express").Router();
const { tokenVerify, adminTokenVerify } = require("../common/tokenVerify");
const {
  getTransaction,
  txnByUserId,
  getAllTransaction,
    GET_LEDGER_REPORT_USER,
    Generate_Invoice_By_OrderId,
} = require("../controllers/txn");

router.post("/list/all", adminTokenVerify, getAllTransaction);
router.get("/list", tokenVerify, getTransaction);
router.get("/list/:receiverId", tokenVerify, txnByUserId);
router.get("/ledger", GET_LEDGER_REPORT_USER);
router.get("/generate-invoice", Generate_Invoice_By_OrderId);


module.exports = router;
