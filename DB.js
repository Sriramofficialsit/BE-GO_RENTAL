const mongoose = require("mongoose");
require("dotenv").config();
async function dbconnect() {
  const mongodb_uri = process.env.MONGODB_URL;
  try {
    await mongoose.connect(mongodb_uri);
    console.log("DataBase Connected");
  } catch (error) {
    console.log("DataBase Connection Failed");
    console.log(error.message);
  }
}
module.exports = { dbconnect };
