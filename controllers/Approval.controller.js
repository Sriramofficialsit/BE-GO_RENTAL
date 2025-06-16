const express = require("express");
const Approvals = express.Router();
const Request = require("../models/Request.model");
const Car = require("../models/Car.model");
const path = require("path");
const mongoose = require("mongoose");
const fs = require("fs");
const authMiddleware = require("../middleware/authmiddleware");
const { upload } = require("./User.controller"); // Import upload from User.controller.js

Approvals.post(
  "/requests-insert",
  authMiddleware,
  upload.fields([
    { name: "insurance", maxCount: 1 },
    { name: "rc_book", maxCount: 1 },
    { name: "image", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      console.log("Received requests-insert request:", {
        body: req.body,
        files: req.files,
      });

      const {
        name,
        email,
        phone,
        car_model,
        modelYear,
        ac,
        passengers,
        transmission,
        fuelType,
        seats,
        doors,
        priceperday,
        carNumber,
        from,
        to,
        permited_city,
      } = req.body;

      const insurance = req.files["insurance"]?.[0]?.path;
      const rc_book = req.files["rc_book"]?.[0]?.path;
      const image = req.files["image"]?.[0]?.path;

      // Validation for required fields
      if (
        !name ||
        !email ||
        !phone ||
        !car_model ||
        !modelYear ||
        !insurance ||
        !rc_book ||
        !image ||
        !fuelType ||
        !ac ||
        !passengers ||
        !transmission ||
        !seats ||
        !doors ||
        !priceperday ||
        !carNumber ||
        !from ||
        !to ||
        !permited_city
      ) {
        console.log("Missing required fields:", {
          name, email, phone, car_model, modelYear, insurance, rc_book, image,
          fuelType, ac, passengers, transmission, seats, doors, priceperday,
          carNumber, from, to, permited_city,
        });
        return res.status(400).json({
          message: "All fields are required including PDFs, image, and permitted city!",
          success: false,
        });
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        console.log("Invalid email:", email);
        return res.status(400).json({
          message: "Invalid email format",
          success: false,
        });
      }

      // Phone validation
      if (!/^\d{10}$/.test(phone.trim())) {
        console.log("Invalid phone number:", phone);
        return res.status(400).json({
          message: "Phone number must be a 10-digit number",
          success: false,
        });
      }

      // Car number validation
      const carNumberRegex = /^[A-Z]{2}-\d{4}$/;
      if (!carNumberRegex.test(carNumber.trim())) {
        console.log("Invalid car number:", carNumber);
        return res.status(400).json({
          message: "Car number must be in the format XX-1234 (e.g., AB-1234)",
          success: false,
        });
      }

      // Fuel type validation
      const validFuelTypes = ["Petrol", "Diesel", "Electric"];
      if (!validFuelTypes.includes(fuelType)) {
        console.log("Invalid fuel type:", fuelType);
        return res.status(400).json({
          message: "Fuel type must be one of: Petrol, Diesel, Electric",
          success: false,
        });
      }

      // Transmission validation
      const validTransmissionTypes = ["Auto", "Manual"];
      if (!validTransmissionTypes.includes(transmission)) {
        console.log("Invalid transmission:", transmission);
        return res.status(400).json({
          message: "Transmission must be one of: Auto, Manual",
          success: false,
        });
      }

      // City validation
      const validCities = [
        "chennai", "coimbatore", "madurai", "trichy",
        "hyderbad", "banglore", "kochi", "goa", "cdm",
      ];
      if (!validCities.includes(permited_city)) {
        console.log("Invalid city:", permited_city);
        return res.status(400).json({
          message: `Permitted city must be one of: ${validCities.join(", ")}`,
          success: false,
        });
      }

      // Numeric validations
      if (isNaN(priceperday) || Number(priceperday) <= 0) {
        console.log("Invalid priceperday:", priceperday);
        return res.status(400).json({
          message: "Price per day must be a positive number",
          success: false,
        });
      }
      if (isNaN(passengers) || Number(passengers) < 1 || Number(passengers) > 8) {
        console.log("Invalid passengers:", passengers);
        return res.status(400).json({
          message: "Passengers must be between 1 and 8",
          success: false,
        });
      }
      if (isNaN(seats) || Number(seats) < 1 || Number(seats) > 8) {
        console.log("Invalid seats:", seats);
        return res.status(400).json({
          message: "Seats must be between 1 and 8",
          success: false,
        });
      }
      if (isNaN(doors) || Number(doors) < 2 || Number(doors) > 6) {
        console.log("Invalid doors:", doors);
        return res.status(400).json({
          message: "Doors must be between 2 and 6",
          success: false,
        });
      }
      if (
        isNaN(modelYear) ||
        Number(modelYear) < 1900 ||
        Number(modelYear) > new Date().getFullYear() + 1
      ) {
        console.log("Invalid modelYear:", modelYear);
        return res.status(400).json({
          message: `Model year must be between 1900 and ${new Date().getFullYear() + 1}`,
          success: false,
        });
      }

      // Date validation
      const fromDate = new Date(from.split("-").reverse().join("-"));
      const toDate = new Date(to.split("-").reverse().join("-"));
      if (isNaN(fromDate.getTime())) {
        console.log("Invalid from date:", from);
        return res.status(400).json({
          message: "Invalid 'from' date format. Use DD-MM-YYYY",
          success: false,
        });
      }
      if (isNaN(toDate.getTime())) {
        console.log("Invalid to date:", to);
        return res.status(400).json({
          message: "Invalid 'to' date format. Use DD-MM-YYYY",
          success: false,
        });
      }
      if (toDate <= fromDate) {
        console.log("Invalid date range:", { from, to });
        return res.status(400).json({
          message: "End date must be after start date",
          success: false,
        });
      }

      const newRequest = new Request({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        car_model: car_model.trim(),
        carNumber: carNumber.trim().toUpperCase(),
        modelYear: Number(modelYear),
        insurance,
        rc_book,
        image,
        ac: ac === "true" || ac === true,
        passengers: Number(passengers),
        transmission,
        fuelType,
        seats: Number(seats),
        doors: Number(doors),
        priceperday: Number(priceperday),
        status: "pending",
        from: fromDate,
        to: toDate,
        permited_city,
      });

      console.log("Attempting to save request:", newRequest);
      const savedRequest = await newRequest.save();
      console.log("Request saved successfully:", savedRequest._id);

      return res.status(201).json({
        message: "Request submitted successfully",
        success: true,
        data: savedRequest,
      });
    } catch (error) {
      console.error("Error inserting request:", {
        message: error.message,
        stack: error.stack,
        code: error.code,
        name: error.name,
      });
      if (error.name === "ValidationError") {
        return res.status(400).json({
          message: "Validation failed",
          success: false,
          error: Object.values(error.errors).map((err) => err.message),
        });
      }
      if (error.code === 11000) {
        return res.status(400).json({
          message: "Car number already exists in requests",
          success: false,
        });
      }
      return res.status(500).json({
        message: "Failed to submit request",
        success: false,
        error: error.message,
      });
    }
  }
);

Approvals.get("/request-get-all", authMiddleware, async (req, res) => {
  const { email } = req.query;

  try {
    const query = {};
    if (email) {
      query.email = email;
    }
    const data = await Request.find({});
    console.log(`All requests with email "${email}":`, data);
    return res.status(200).json({
      data,
      message: "Data fetched successfully",
      success: true,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
      success: false,
    });
  }
});

Approvals.get("/request-get-all-renter", authMiddleware, async (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({
      message: "Email is required",
      success: false,
    });
  }

  try {
    const data = await Request.find({ email });
    console.log(`Renter requests for email "${email}":`, data.length);
    return res.status(200).json({
      data,
      message: "Data fetched successfully",
      success: true,
    });
  } catch (error) {
    console.error("Error fetching renter requests:", error.message);
    return res.status(500).json({
      message: "Failed to fetch renter requests",
      success: false,
      error: error.message,
    });
  }
});

Approvals.get("/request-get/:status", authMiddleware, async (req, res) => {
  const { status } = req.params;
  const { email } = req.query;

  if (!["pending", "approved", "disapproved"].includes(status)) {
    return res.status(400).json({
      message: "Invalid status",
      success: false,
    });
  }

  try {
    const query = { status };
    if (email) {
      query.email = email;
    }
    const data = await Request.find(query);
    console.log(`Requests for status "${status}" with email "${email || 'all'}":`, data.length);
    return res.status(200).json({
      data,
      message: "Data fetched successfully",
      success: true,
    });
  } catch (error) {
    console.error("Error fetching requests by status:", error.message);
    return res.status(500).json({
      message: "Failed to fetch requests",
      success: false,
      error: error.message,
    });
  }
});

const parseDateString = (dateString) => {
  const [day, month, year] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
};

Approvals.put("/approve/:id", authMiddleware, async (req, res) => {
  try {
    const requestId = req.params.id;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      console.log("Invalid request ID:", requestId);
      return res.status(400).json({
        message: "Invalid request ID format",
        success: false,
      });
    }

    // Approve request status
    const request = await Request.findByIdAndUpdate(
      requestId,
      { status: "approved" },
      { new: true }
    );

    if (!request) {
      console.log("Request not found:", requestId);
      return res.status(404).json({
        message: "Request not found",
        success: false,
      });
    }

    // Check for duplicate car number
    const existingCar = await Car.findOne({ carNumber: request.carNumber });
    if (existingCar) {
      console.log("Car number already exists:", request.carNumber);
      return res.status(400).json({
        message: "A car with this car number already exists in the Car collection",
        success: false,
      });
    }

    // Convert dates safely
    const fromDate = new Date(request.from);
    const toDate = new Date(request.to);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      console.log("Invalid dates in request:", { from: request.from, to: request.to });
      return res.status(400).json({
        message: "Invalid 'from' or 'to' date format in the request",
        success: false,
      });
    }

    // Optional: validate date logic
    if (fromDate > toDate) {
      return res.status(400).json({
        message: "'From' date must be earlier than or equal to 'to' date",
        success: false,
      });
    }

    // Create new Car entry
    const newCar = new Car({
      name: request.car_model,
      email: request.email,
      modelYear: request.modelYear,
      priceperday: request.priceperday,
      transmission: request.transmission,
      ac: request.ac,
      passengers: request.passengers,
      seats: request.seats,
      doors: request.doors,
      image: request.image,
      ratings: request.ratings || 0,
      reviews: request.reviews || 0,
      fuelType: request.fuelType,
      carNumber: request.carNumber,
      from: fromDate,
      to: toDate,
      permited_city: request.permited_city,
    });

    const savedCar = await newCar.save();
    console.log("Car added successfully:", savedCar._id);

    return res.status(200).json({
      message: "Request approved and car added to Car collection successfully",
      success: true,
      data: request,
    });
  } catch (error) {
    console.error("Error in approve route:", {
      message: error.message,
      stack: error.stack,
      code: error.code,
    });

    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Validation failed",
        success: false,
        error: Object.values(error.errors).map((err) => err.message),
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        message: "Car number already exists",
        success: false,
      });
    }

    return res.status(500).json({
      message: "Failed to approve request",
      success: false,
      error: error.message,
    });
  }
});

Approvals.put("/disapprove/:id", authMiddleware, async (req, res) => {
  try {
    const requestId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      console.log("Invalid request ID:", requestId);
      return res.status(400).json({
        message: "Invalid request ID format",
        success: false,
      });
    }

    const request = await Request.findByIdAndUpdate(
      requestId,
      { status: "disapproved" },
      { new: true }
    );
    if (!request) {
      console.log("Request not found:", requestId);
      return res.status(404).json({
        message: "Request not found",
        success: false,
      });
    }

    console.log("Request disapproved:", requestId);
    return res.status(200).json({
      message: "Request disapproved successfully",
      success: true,
      data: request,
    });
  } catch (error) {
    console.error("Error in disapprove route:", {
      message: error.message,
      stack: error.stack,
    });
    return res.status(500).json({
      message: "Failed to disapprove request",
      success: false,
      error: error.message,
    });
  }
});

Approvals.delete("/request-del/:id", authMiddleware, async (req, res) => {
  try {
    const requestId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      console.log("Invalid request ID:", requestId);
      return res.status(400).json({
        message: "Invalid request ID format",
        success: false,
      });
    }

    const deletedRequest = await Request.findByIdAndDelete(requestId);
    if (!deletedRequest) {
      console.log("Request not found:", requestId);
      return res.status(404).json({
        message: "Request not found",
        success: false,
      });
    }

    // Delete associated files
    const filesToDelete = [deletedRequest.image, deletedRequest.insurance, deletedRequest.rc_book];
    for (const filePath of filesToDelete) {
      if (filePath) {
        try {
          const fullPath = path.join(__dirname, "..", filePath);
          await fs.promises.unlink(fullPath);
          console.log("Deleted file:", fullPath);
        } catch (err) {
          console.warn("Could not delete file:", filePath, err.message);
        }
      }
    }

    console.log("Request deleted successfully:", requestId);
    return res.status(200).json({
      message: "Request deleted successfully",
      success: true,
      data: deletedRequest,
    });
  } catch (error) {
    console.error("Error deleting request:", {
      message: error.message,
      stack: error.stack,
    });
    return res.status(500).json({
      message: "Failed to delete request",
      success: false,
      error: error.message,
    });
  }
});

Approvals.get("/filter-get", authMiddleware, async (req, res) => {
  const { location, from, to } = req.query;

  if (!location || !from || !to) {
    return res.status(400).json({
      message: "All fields (location, from, to) are required!",
      success: false,
    });
  }

  try {
    const fromDate = new Date(from.split("-").reverse().join("-"));
    const toDate = new Date(to.split("-").reverse().join("-"));

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      console.log("Invalid dates:", { from, to });
      return res.status(400).json({
        message: "Invalid date format for 'from' or 'to'. Use DD-MM-YYYY",
        success: false,
      });
    }

    if (toDate <= fromDate) {
      console.log("Invalid date range:", { from, to });
      return res.status(400).json({
        message: "End date must be after start date",
        success: false,
      });
    }

    const data = await Car.find({
      permited_city: location,
      from: { $lte: toDate },
      to: { $gte: fromDate },
      status: "available",
    });

    console.log(`Fetched ${data.length} cars for location "${location}" from ${from} to ${to}`);
    return res.status(200).json({
      data,
      message: data.length > 0 ? "Available cars fetched successfully!" : "No available cars found",
      success: true,
    });
  } catch (error) {
    console.error("Error fetching cars:", {
      message: error.message,
      stack: error.stack,
    });
    return res.status(500).json({
      message: "Failed to fetch cars",
      success: false,
      error: error.message,
    });
  }
});

Approvals.get("/request-get", authMiddleware, async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      message: "Email is required",
      success: false,
    });
  }

  try {
    const data = await Request.find({ email });
    console.log(`Requests for email "${email}":`, data.length);
    return res.status(200).json({
      data,
      message: "Data fetched successfully",
      success: true,
    });
  } catch (error) {
    console.error("Error fetching requests:", error.message);
    return res.status(500).json({
      message: "Failed to fetch requests",
      success: false,
      error: error.message,
    });
  }
});

module.exports = { Approvals };
