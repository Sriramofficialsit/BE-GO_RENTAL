const mongoose = require("mongoose");

const ProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", 
      required: true,
    },
    name: { type: String, required: true },
    lastname: { type: String, required: true },
    gender: { type: String, enum: ["male", "female"], required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    aadhaarNo: { type: String, unique: true },
    drivingLicenceNo: { type: String, unique: true }, 
    aadhaarFile: { type: String },
    drivingLicenceFile: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ProfileDetails", ProfileSchema);
