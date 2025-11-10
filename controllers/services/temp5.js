const axios = require("axios");

const rechargeRequest = async () => {
  try {
    const url = "https://api.new.techember.in/api/cyrus/recharge_request";
    const params = {
      number: "8770475416",
      amount: "10",
      mPin: "1234",
      operator: "2",
      circle: "93",
      isPrepaid: true,
    };

    const headers = {
      token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2OGNmOTQwNTczZTFkMTc3M2Q0MmQwNDkiLCJpYXQiOjE3NjE5Mjc4NTR9.etOCmmP1wHO6DppWvJfw5uflyY_zV_ufNNE7mUAXaDU", // Custom header
    };

    const response = await axios.get(url, { params, headers });

    console.log("Recharge API Response:",response);
    // console.log(JSON.stringify(response.data, null, 2)); // pretty print JSON

  } catch (error) {
    console.error("Recharge API Error:");
    if (error.response) {
      // Server responded with a status other than 2xx
      console.error("Status:",error.response);
      console.error("Data:", error.response);
    } else {
      // No response or other error
      console.error("Message:", error.message);
    }
  }
};

// Run the function
rechargeRequest();
