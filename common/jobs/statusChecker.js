// const cron = require("node-cron");
// const ServiceRequest = require("../../models/newModels/serviceRequest");
// const {
//   CHECK_PENDING_TRANSACTION,
// } = require("../../controllers/services/recharge");

// const scheduleJobs = () => {
//   // cron.schedule("*/5 * * * *", CHECK_PENDING_TRANSACTION);
// };

// // Run 6 hour
// cron.schedule("* * * * *", async () => {
//   const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

//   const updated = await ServiceRequest.updateMany(
//     {
//       status: "PENDING", // only expire if still pending
//       createdAt: { $lte: oneHourAgo },
//     },
//     {
//       $set: { status: "EXPIRED" },
//     }
//   );
//   console.log("Job run");
//   if (updated.modifiedCount > 0) {
//     console.log(`${updated.modifiedCount} requests marked as expired.`);
//   }
// });


// module.exports = scheduleJobs;

