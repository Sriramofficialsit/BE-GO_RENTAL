const Ticket = require("express").Router();
const bookings = require("../models/Booking.model");
const car = require("../models/Car.model");
const Razorpay = require("razorpay");
const razorpay = require("../utils/razorpay");
const nodemailer = require("nodemailer");
const authMiddleware = require("../middleware/authmiddleware");
const { response } = require("express");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendTicketCreationEmail = async (ticket, car_data, userEmail) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: userEmail,
    subject: "Ticket Creation Confirmation",
    html: `
      <h2>Ticket Created Successfully!</h2>
      <p>Dear Customer,</p>
      <p>Your booking has been confirmed. Below are the details:</p>
      <ul>
        <li><strong>Ticket ID:</strong> ${ticket._id}</li>
        <li><strong>Car Number:</strong> ${ticket.car_number}</li>
        <li><strong>Location:</strong> ${ticket.location}</li>
        <li><strong>Permitted City:</strong> ${ticket.permitted_city}</li>
        <li><strong>From:</strong> ${new Date(
          ticket.from
        ).toLocaleString()}</li>
        <li><strong>To:</strong> ${new Date(ticket.to).toLocaleString()}</li>
        <li><strong>Amount:</strong> ₹${ticket.amount}</li>
      </ul>
      <p>Thank you for booking with us!</p>
      <p>Best regards,<br>Your Company Name</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Ticket creation email sent successfully");
  } catch (error) {
    console.error("Error sending ticket creation email:", error);
    throw new Error("Failed to send ticket creation email");
  }
};
const sendTicketCancellationEmail = async (ticket, car_data, userEmail) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: userEmail,
    subject: "Ticket Cancellation Confirmation",
    html: `
      <h2>Ticket Cancelled</h2>
      <p>Dear Customer,</p>
      <p>Your booking has been cancelled. Below are the details:</p>
      <ul>
        <li><strong>Ticket ID:</strong> ${ticket._id}</li>
        <li><strong>Car Number:</strong> ${ticket.car_number}</li>
        <li><strong>Location:</strong> ${ticket.location}</li>
        <li><strong>Permitted City:</strong> ${ticket.permitted_city}</li>
        <li><strong>From:</strong> ${new Date(
          ticket.from
        ).toLocaleString()}</li>
        <li><strong>To:</strong> ${new Date(ticket.to).toLocaleString()}</li>
        <li><strong>Amount Refunded:</strong> ₹${ticket.amount}</li>
      </ul>
      <p>We hope to serve you again in the future.</p>
      <p>Best regards,<br>Your Company Name</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Ticket cancellation email sent successfully");
  } catch (error) {
    console.error("Error sending ticket cancellation email:", error);
    throw new Error("Failed to send ticket cancellation email");
  }
};
Ticket.post("/create-ticket", authMiddleware, async (req, res) => {
  const {
    carNumber,
    location,
    permitted_city,
    from,
    to,
    owner_id,
    payment_id,
    amount,
    userid,
    userEmail,
  } = req.body;

  if (
    !carNumber ||
    !location ||
    !permitted_city ||
    !from ||
    !to ||
    !owner_id ||
    !userid ||
    !userEmail
  ) {
    return res.json({
      message: "All fields, including userEmail, are required!",
      success: false,
    });
  }

  try {
    const car_data = await car.findOne({ carNumber });

    if (!car_data) {
      return res.json({
        message: "Car not found!",
        success: false,
      });
    }

    if (car_data.status === "busy") {
      return res.json({
        message: "Car is already booked (status: busy)!",
        success: false,
      });
    }

    const ticket = new bookings({
      image: car_data.image,
      location,
      permitted_city,
      car_number: car_data.carNumber,
      from,
      to,
      owner_id,
      payment_id: payment_id || null,
      amount: amount || 0,
      userid: userid,
    });

    await ticket.save();
    await car.findOneAndUpdate(
      { carNumber },
      { status: "busy" },
      { new: true }
    );

    await sendTicketCreationEmail(ticket, car_data, userEmail);

    return res.json({
      ticket,
      message: "Ticket created, car status updated to 'busy', and email sent",
      success: true,
    });
  } catch (error) {
    return res.json({
      message: error.message,
      success: false,
    });
  }
});
Ticket.post("/ticket-cancelled", authMiddleware, async (req, res) => {
  const { ticket_id, car_number, userEmail } = req.body;

  if (!ticket_id || !car_number || !userEmail) {
    return res.json({
      message: "Ticket ID, Car Number, and userEmail are required!",
      success: false,
    });
  }

  try {
    const ticket = await bookings.findById(ticket_id);
    if (!ticket) {
      return res.json({ message: "Ticket not found!", success: false });
    }

    if (ticket.status === "expired") {
      return res.json({
        message: "Cannot cancel an expired ticket!",
        success: false,
      });
    }

    if (ticket.payment_id) {
      try {
        if (!ticket.payment_id.startsWith("pay_")) {
          throw new Error("Invalid payment ID format");
        }

        const payment = await razorpay.payments.fetch(ticket.payment_id);
        if (payment.status !== "captured") {
          throw new Error("Payment is not eligible for refund");
        }

        const refund = await razorpay.payments.refund(ticket.payment_id, {
          amount: ticket.amount * 100,
          speed: "normal",
        });

        console.log("Refund initiated:", refund);
      } catch (refundError) {
        console.error("Refund failed:", JSON.stringify(refundError, null, 2));
        const errorMessage =
          refundError?.error?.description ||
          refundError?.message ||
          "Unknown error occurred during refund";

        return res.status(500).json({
          message: `Refund failed: ${errorMessage}`,
          success: false,
        });
      }
    }

    ticket.status = "cancelled";
    await ticket.save();

    const updatedCar = await car.findOneAndUpdate(
      { carNumber: car_number },
      { status: "available" },
      { new: true }
    );
    await sendTicketCancellationEmail(ticket, updatedCar, userEmail);

    return res.json({
      message:
        "Ticket cancelled, status updated, refund initiated, and email sent",
      success: true,
      ticket,
      car: updatedCar,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Error cancelling ticket",
      success: false,
    });
  }
});
Ticket.get("/get-tickets", authMiddleware, async (req, res) => {
  try {
    const tickets = await bookings.find();

    for (let ticket of tickets) {
      const isExpired = new Date(ticket.to) < new Date();
      if (isExpired && ticket.status !== "expired") {
        ticket.status = "expired";
        await ticket.save();
      }
    }

    res.json({
      tickets,
      message: "Tickets fetched and expired status updated",
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
      success: false,
    });
  }
});
Ticket.get("/get-tickets-user", authMiddleware, async (req, res) => {
  const { userid } = req.query;
  if (!userid) {
    return res.json({
      message: "user Id Is Required!!",
      success: false,
    });
  }
  try {
    const tickets = await bookings.find({ userid });

    for (let ticket of tickets) {
      const isExpired = new Date(ticket.to) < new Date();
      if (isExpired && ticket.status !== "expired") {
        ticket.status = "expired";
        await ticket.save();
      }
    }

    res.json({
      tickets,
      message: "Tickets fetched and expired status updated",
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
      success: false,
    });
  }
});
Ticket.get("/get-tickets-renter", authMiddleware, async (req, res) => {
  const { owner_id } = req.query;
  if (!owner_id) {
    return res.json({
      message: "owner is required!!",
      success: false,
    });
  }
  try {
    const tickets = await bookings.find({ owner_id });
    for (let ticket of tickets) {
      const isExpired = new Date(ticket.to) < new Date();
      if (isExpired && ticket.status !== "expired") {
        ticket.status = "expired";
        await ticket.save();
      }
    }

    res.json({
      tickets,
      message: "Tickets fetched and expired status updated",
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
      success: false,
    });
  }
});
Ticket.get("/get-all-tickets-renter", authMiddleware, async (req, res) => {
  try {
    const tickets = await bookings.find();
    for (let ticket of tickets) {
      const isExpired = new Date(ticket.to) < new Date();
      if (isExpired && ticket.status !== "expired") {
        ticket.status = "expired";
        await ticket.save();
      }
    }

    res.json({
      tickets,
      message: "Tickets fetched and expired status updated",
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
      success: false,
    });
  }
});
Ticket.get("/booking-count", authMiddleware, async (req, res) => {
  const { email } = req.body;
  try {
    const count = await bookings.countDocuments();
    return res.json({
      count: count,
      success: true,
    });
  } catch (error) {
    return res.json({
      message: error.message,
      success: false,
    });
  }
});
Ticket.get("/booking-count-renter", authMiddleware, async (req, res) => {
  const { owner_id } = req.query;

  if (!owner_id) {
    return res.json({
      message: "Owner ID is required!",
      success: false,
    });
  }

  try {
    const count = await bookings.countDocuments({ owner_id });
    return res.json({
      count,
      success: true,
    });
  } catch (error) {
    return res.json({
      message: error.message,
      success: false,
    });
  }
});

module.exports = { Ticket };
