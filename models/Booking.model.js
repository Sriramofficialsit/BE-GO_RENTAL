const mongoose = require("mongoose");

const BookingSchema = mongoose.Schema({
  userid: {
    type: String,
    required: true,
  },
  image: {
    type: String,
  },
  location: {
    type: String,
    required: true,
  },
  permitted_city: {
    type: String,
    required: true,
  },
  car_number: {
    type: String,
  },
  from: {
    type: Date,
    required: true,
  },
  to: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ["upcomming", "expired", "cancelled"],
    default: "upcomming",
  },
  owner_id: {
    type: String,
    required: true,
  },
  ticket_id: {
    type: String,
  },

  // Payment Details
  payment_id: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  refund_id: {
    type: String,
    default: null,
  },
  is_refunded: {
    type: Boolean,
    default: false,
  },
});

module.exports = mongoose.model("Bookings", BookingSchema);
