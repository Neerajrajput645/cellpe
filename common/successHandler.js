const jwt = require("jsonwebtoken");
const User = require("../models/userSchema");
const Admin = require("../models/adminSchema");
const { successLogger } = require("./logger");

const successHandler = async (req, res, data) => {
  const isAuth = req?.headers?.token;
  const getData = () => {
    if (isAuth) {
      return new Promise((resolve, reject) => {
        jwt.verify(isAuth, process.env.JWT_SECRET, async (err, data) => {
          if (err) {
            reject(err);
          } else {
            const { _id } = data;
            // success response
            const userFound = await User.findById(_id);
            resolve(userFound);
          }
        });
      });
    }
  };
  const userData = await getData();
  const remarks = isAuth
    ? `userid: ${userData?._id}, name: ${userData?.firstName} ${userData?.lastName}, phone: ${userData?.phone}, ${data.Remarks}`
    : data.Remarks;
  successLogger.log("info", remarks); // success logs
  res?.json({
    Error: false,
    Status: true,
    ResponseStatus: 1,
    ...data,
  });
};

module.exports = successHandler;
