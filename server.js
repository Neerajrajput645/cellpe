const path = require("path");
require("dotenv/config");
const bodyParser = require("body-parser");
const express = require("express");
// const rateLimit = require("express-rate-limit");
const app = express();
// const http = require("http");
// const blobStream = require("blob-stream");
const cors = require("cors");
const PORT = process.env.PORT || 5000;
const connection = require("./database");
const helmet = require("helmet");
const {Recharge_CallBack_Handler} = require("./controllers/services/recharge");
const {combinedHistory} = require("./controllers/services/report.js");
// const puppeteer = require("puppeteer");
// const AppSetting = require("./models/appSetting");
// const successHandler = require("./common/successHandler");
// const Product = require("./models/shopping/productSchema");
// const Category = require("./models/shopping/categorySchema");
// const SubCategory = require("./models/shopping/subCategorySchema");
const { dashboardApi } = require("./controllers/admin");
const getIpAddress = require("./common/getIpAddress");
// const geoip = require("geoip-lite");
// const nodemailer = require("nodemailer");
// const { cashfreePaymentCallback } = require("./controllers/payment");
// const {
//   Recharge_All_Status_Verify,
// } = require("./controllers/services/recharge");
// const { generatePDF } = require("./common/createHtmlToPdf");
// const { checkAndRenewToken } = require("./common/paygicTokenGenerate");
const { adminTokenVerify, tokenVerify } = require("./common/tokenVerify");
const { Generate_Excel_Report } = require("./common/createHtmlToPdf");
// const { default: axios } = require("axios");

// Connection to db
connection();

// Other
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(cors());
app.use(helmet());
app.use(
  express.json({
    limit: "1mb",
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    },
  })
);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
// app.use("/api/kyc", require("./routes/kycRoute"));
app.use("/api/txn", require("./routes/txnRoute"));
app.use("/api/auth", require("./routes/authRoute"));
app.use("/api/admin", require("./routes/adminRoute"));
app.use("/api/ip-address", require("./routes/ipRoute"));  // ip address CRUD
// app.use("/api/bus", require("./routes/busBooking"));
app.get("/api/user/combined-history", tokenVerify, combinedHistory);
app.use("/api/user", require("./routes/userRoute"));
// app.use("/api/bank", require("./routes/bankRoute"));
app.use("/api/wallet", require("./routes/walletRoute"));
app.use("/api/commission", require("./routes/newRoutes/commission.js"));
// webhook callback for recharge status
app.all("/api/webhook/callback", Recharge_CallBack_Handler);
// for webhook callbacks
app.use("/api/setting", require("./routes/appSetting"));
app.use("/api/banner", require("./routes/bannerRoute"));
app.use("/api/home-banner", require("./routes/newRoutes/homeBanner.js"));
app.use("/api/pop-image", require("./routes/newRoutes/homePopImage.js"));
// app.use("/api/game", require("./routes/gameRoute"));
app.use("/api/service", require("./routes/serviceRoute"));
// app.use("/api/shipping", require("./routes/shippingRoute"));
app.use("/api/affiliate-banner", require("./routes/affiliateBannerRoute"));

app.use("/api/notification", require("./routes/notificationRoute"));
// app.get("/api/commission/list", require("./controllers/services/recharge.js").commission);
app.use("/api/payment", require("./routes/paymentRoutes"));
//app.get("api/commission/list", require("./controllers/services/recharge.js").commission);
// app.use("/api", require("./routes/other"));
app.use("/api/cyrus", require("./routes/services"));
// app.use("/api/webhook", require("./routes/webhook"));
app.use("/api/affiliate", require("./routes/affiliateRoute"));
// app.use("/api/task", require("./routes/EarnTask/EarnTaskRoute"));
// dashboard counts api
app.get("/api/dashboard", dashboardApi);
// app.get("/api/download-report", adminTokenVerify, Generate_Excel_Report);
// app.use("/api/privacy-policy", require("./routes/newRoutes/privacyPolicy"));
// app.use("/api/term-condition", require("./routes/newRoutes/termCondition"));
// app.use("/api/refund-policy", require("./routes/newRoutes/refundPolicy"));
// app.use("/api/about-us", require("./routes/newRoutes/AboutUs"));
// app.use("/api/subpaisa", require("./routes/newRoutes/subPaisa"));
// app.use("/api/truecaller", require("./routes/newRoutes/nameFind"));
// app.use("/api/faq", require("./routes/newRoutes/faq"));
// app.post("/api/fetch-bill-payment", require("./temp/tmp").fetchBillPayment);
// ======================== service category ==============================
// app.use("/api/service-category", require("./routes/newRoutes/serviceCategory"));
// ======================== service provider ==============================
// app.use("/api/provider-service", require("./routes/newRoutes/servicesRoute"));
//========================= Provider signup ============================
// app.use("/api/service-provider", require("./routes/newRoutes/serviceProvider"));
// ======================== Request routes ================================
// app.use("/api/service-request", require("./routes/newRoutes/serviceRequest"));
// ========================== Provider Review ==============================
// app.use("/api/provider-review", require("./routes/newRoutes/providerReview"));

app.get("/api", (req, res) => {
  res.send(getIpAddress(req));
});

// =======================Logout ===========================
// app.post("/api/user/logout",(req,res)=>{
//   try {
//     return res.status(200).json({ message: "Logout Successfully" });
//   } catch (error) {
//     console.log("Logout Error", error);
//     res.status(500).json({ message: "Internal Server Error" });
//   }
// })

// ======================= Send To Bank =============================
// app.use("/api/send-to-bank", require("./routes/sendToBank"));

app.get("/api/otp/all/test", require("./temp/allOTP").getAllOTPs);
// app.get("/api/ops/test", require("./temp/ops").allOps);


// app.use("/", (req, res) => {
//   res.send("<h1 style='text-align: center; color:blue; margin-top: 50px;'>Welcome to PinPay API</h1>");
// });
// ------------------ Universal Search Api End --------------- //

// error handler
app.use(require("./common/errorHandler"));

// const { Server } = require("socket.io");
// const server = http.createServer(app);
// const io = new Server(server, {
//   cors: { origin: "*" },
// });

// 🔁 Attach globals
// global.io = io;
// global.providerSockets = {};

// Socket Setup
// const setupSocket = require("./sockets");
// setupSocket(io);

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server started on http://localhost:${PORT}`);
});
