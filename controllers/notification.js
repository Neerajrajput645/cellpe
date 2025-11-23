const asyncHandler = require("express-async-handler");
const successHandler = require("../common/successHandler");
const Notification = require("../models/notificationSchema");
const sendNotification = require("../common/sendNotification");
const { encryptFunc } = require("../common/encryptDecrypt");
const userSchema = require("../models/userSchema");
const OneSignal = require("@onesignal/node-onesignal");

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;
const app_key_provider = {
  getToken() {
    return ONESIGNAL_REST_API_KEY;
  },
};

const configuration = OneSignal.createConfiguration({
  authMethods: {
    app_key: {
      tokenProvider: app_key_provider,
    },
  },
});

const client = new OneSignal.DefaultApi(configuration);

// notification list by user
const notificationListByUser = asyncHandler(async (req, res) => {
  const { _id } = req.data;
  const data = await Notification.find({ recipient: _id }).populate("sender");

  // success handler
  successHandler(req, res, {
    Remarks: "Fetch all notifications",
    Data: (data.reverse()),
  });
});

// notification list
const notificationList = asyncHandler(async (req, res) => {
  const data = await Notification.find({ byAdmin: true });
  // success handler
  successHandler(req, res, {
    Remarks: "Fetch all notifications",
    Data: (data.reverse()),
  });
});

// push notification
// const pushNotification = asyncHandler(async (req, res) => {
//   const { title, content } = req.body;
//   const data = { title, body: content };

//   await Notification.create({ ...data, byAdmin: true });
//   const deviceToken = "all";
//   deviceToken && sendNotification(data, deviceToken);

//   // success handler
//   successHandler(req, res, { Remarks: "Pushed notifications to all users" });
// });

const chunkArray = (array, size) => {
  console.log("Calling");
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
};

const pushNotification = asyncHandler(async (req, res) => {
  try {
    const { title, content } = req.body;
    const data = { title, body: content };
    console.log("Sending notification with title:", title, "and content:", content);
    console.log("header token:", req.headers.token);
    const users = await userSchema.find({
      deviceToken: { $ne: null },
      doNotNotify: { $ne: true },
    });

    const playerIds = users
      .map((user) => user.deviceToken)
      .filter(
        (id) =>
          typeof id === "string" &&
          id.trim() !== "" &&
          /^[0-9a-fA-F-]{36}$/.test(id.trim()) // UUIDv4 format check
      );

    if (playerIds.length === 0) {
      console.log("No users to notify.");
      return successHandler(req, res, {
        Remarks: "No users found to notify",
        count: 0
      });
      // return res.send("no user found");
    }


    const batches = chunkArray(playerIds, 2000);
    const notification = new OneSignal.Notification();
    notification.app_id = ONESIGNAL_APP_ID;
    notification.headings = { en: title };
    notification.contents = { en: content };
    notification.small_icon = "ic_stat_onesignal_default";
    for (const batch of batches) {
      notification.include_player_ids = batch;
      const { id } = await client.createNotification(notification);
    }
    await Notification.create({ ...data, byAdmin: true });

    // success handler
    successHandler(req, res, {
      Remarks: "Notifications Sent Successfully",
    });
  } catch (error) {
    console.error("Unexpected error sending notification:");
    console.error("HTTP-Code:", error.status);
    console.error("Message:", error.message);
    console.error("Body:", error.body);
  }
});

const pushNotificationImage = asyncHandler(async (req, res) => {
  try {
    const { title, content } = req.body; // <-- ADD image in request body
    const data = { title, body: content };
    const image = req?.file?.path || "uploads/notification/defaultNotify.jpg"
    if (image) data.image = image;
    console.log("Sending notification with title:", title, "and content:", content);
    console.log("header token:", req.headers.token);
    console.log("body:", req.body);
    const users = await userSchema.find({
      deviceToken: { $ne: null },
      doNotNotify: { $ne: true },
    });

    const playerIds = users
      .map((user) => user.deviceToken)
      .filter(
        (id) =>
          typeof id === "string" &&
          id.trim() !== "" &&
          /^[0-9a-fA-F-]{36}$/.test(id.trim())
      );

    if (playerIds.length === 0) {
      console.log("No users to notify.");
      return successHandler(req, res, {
        Remarks: "No users found to notify",
        count: 0
      });
    }

    const batches = chunkArray(playerIds, 2000);

    for (const batch of batches) {
      const notification = new OneSignal.Notification();
      notification.app_id = ONESIGNAL_APP_ID;
      notification.headings = { en: title };
      notification.contents = { en: content };
      notification.include_player_ids = batch;

      // IMPORTANT: IMAGE SUPPORT
      if (image) {
        notification.big_picture = image; // Android big image
        notification.large_icon = image; // Thumbnail
        notification.ios_attachments = { id1: image }; // iOS big image
      }

      await client.createNotification(notification);
    }


    await Notification.create({ ...data, byAdmin: true });
    successHandler(req, res, {
      Remarks: "Notifications Sent Successfully",
    });
  } catch (error) {
    console.error("Unexpected error sending notification:");
    console.error("HTTP-Code:", error.status);
    console.error("Message:", error.message);
    console.error("Body:", error.body);
  }
});


module.exports = { notificationListByUser, notificationList, pushNotification, pushNotificationImage };
