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
      validate: [
        {
          validator: validator.isEmail,
          message: "Invalid email format",
        },
        {
          validator: function (v) {
            return /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(v);
          },
          message: "Email does not match required pattern",
        },
      ],
    },

    password: {
      type: String,
      required: true,
      validate: {
        validator: function (v) {
          // Allows any characters but requires at least 1 letter and 1 digit, and min 8 chars
          return /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(v);
        },
        message:
          "Password must be at least 8 characters long and contain at least one letter and one number",
      },
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
