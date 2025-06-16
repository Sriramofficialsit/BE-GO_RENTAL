const mongoose = require("mongoose");

const requestSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    car_model: { type: String, required: true },
    carNumber: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      match: /^[A-Z]{2}-\d{4}$/,
    },
    modelYear: {
      type: Number,
      required: true,
      min: 1900,
      max: new Date().getFullYear() + 1,
    },
    insurance: { type: String, required: true },
    rc_book: { type: String, required: true },
    image: { type: String, required: true },
    ac: { type: Boolean, required: true },
    passengers: { type: Number, required: true },
    transmission: { type: String, required: true },
    fuelType: {
      type: String,
      enum: ["Petrol", "Diesel", "Electric"],
      required: true,
    },
    reviews: {
      type: String,
      required: false,
      min: 0,
      default: 0,
    },
    ratings: {
      type: Number,
      required: false,
      min: 0,
      max: 5,
      default: 0,
    },

    seats: { type: Number, required: true },
    doors: { type: Number, required: true },
    priceperday: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "disapproved"],
      default: "pending",
    },
    from: { type: String, required: true },
    to: { type: String, required: true },
    permited_city: {
      type: String,
      required: true,
      enum: [
        "chennai",
        "coimbatore",
        "madurai",
        "trichy",
        "hyderbad",
        "banglore",
        "kochi",
        "goa",
        "cdm",
      ],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Request", requestSchema);
