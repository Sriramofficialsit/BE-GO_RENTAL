const mongoose = require("mongoose");
const validator = require("validator");

const UserSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      validate: {
        validator: validator.isEmail,
        message: "Invalid email format",
      },
    },
    password: {
      type: String,
      required: true,
    },
    mobileno: {
      type: Number,
      required: true,
    },
    role: {
      type: String,
      enum: ["user", "admin", "renter"],
      default: "user",
    },
    profile: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProfileDetails",
    },
    bookings: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Booking",
      },
    ],
    resetpasswordtoken: { type: String },
    resetpasswordexpires: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("users", UserSchema);
