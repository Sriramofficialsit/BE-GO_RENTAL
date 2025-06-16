const mongoose = require("mongoose");

const CarSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
  },
  modelYear: {
    type: Number,
    required: true,
    min: 1900,
    max: new Date().getFullYear() + 1,
  },
  priceperday: {
    type: Number,
    required: true,
    min: 0,
  },
  transmission: {
    type: String,
    enum: ["Auto", "Manual"],
    required: true,
  },
  ac: {
    type: Boolean,
    required: true,
  },
  passengers: {
    type: Number,
    required: true,
    min: 1,
    max: 8,
  },
  seats: {
    type: Number,
    required: true,
    min: 1,
    max: 8,
  },
  doors: {
    type: Number,
    required: true,
    min: 2,
    max: 6,
  },
  image: {
    type: String,
    required: true,
  },
  ratings: {
    type: Number,
    required: true,
    min: 0,
    max: 5,
  },
  reviews: {
    type: String,
    required: true,
    min: 0,
  },
  fuelType: {
    type: String,
    enum: ["Petrol", "Diesel", "Electric"],
    required: true,
  },
  carNumber: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    match: /^[A-Z]{2}-\d{4}$/,
  },
  from: {
    type: Date,
    required: true,
  },
  to: {
    type: Date,
    required: true,
  },
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
  status: {
    type: String,
    enum: ["available", "busy"],
    default: "available",
  },
});

module.exports = mongoose.model("Cars", CarSchema);
