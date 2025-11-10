const jwt = require("jsonwebtoken");
const User = require("../models/userSchema");
const { errorLogger } = require("./logger");

const errorHandler = async (err, req, res, next) => {
  const isAuth = req.headers.token;
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
    ? `userid: ${userData?._id}, name: ${userData?.firstName} ${
        userData?.lastName
      }, phone: ${userData?.phone}, ${err.message.replace("Error: ", "")}`
    : err.message.replace("Error: ", "");

  const StatusCode = res.statusCode ? res.statusCode : 500;
  errorLogger.log("error", remarks); // error logs
  res.json({
    Error: true,
    Status: false,
    ResponseStatus: 0,
    StatusCode: `Ex${StatusCode}`,
    Remarks: err.message,
  });
};

module.exports = errorHandler;
