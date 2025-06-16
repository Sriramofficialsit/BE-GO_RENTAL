const Express = require("express");
const Dashboard = Express.Router();
const Car = require("../models/Car.model");
const path = require("path");
const fs = require("fs");
const Request = require("../models/Request.model");
const mongoose = require("mongoose");
const Review = require("../models/Review.model");
const authMiddleware = require("../middleware/authmiddleware");
const { upload } = require("./User.controller"); // Import upload from User.controller.js

Dashboard.get("/cars", authMiddleware, async (req, res) => {
  try {
    const cars = await Car.find({});
    res.status(200).json({
      cars,
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching cars",
      success: false,
      error: error.message,
    });
  }
});

Dashboard.get("/cars-renter", authMiddleware, async (req, res) => {
  const { email } = req.query;
  try {
    const cars = await Car.find({ email });
    res.status(200).json({
      cars,
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching cars",
      success: false,
      error: error.message,
    });
  }
});

Dashboard.post("/car-insert", authMiddleware, upload.single("file"), async (req, res) => {
  try {
    console.log("Received car-insert request:", {
      body: req.body,
      file: req.file ? { filename: req.file.filename, mimetype: req.file.mimetype, size: req.file.size } : null,
    });

    const {
      name,
      priceperday,
      ac,
      passengers,
      transmission,
      seats,
      doors,
      modelYear,
      ratings,
      reviews,
      fuelType,
      carNumber,
      from,
      to,
      permited_city,
      email,
    } = req.body;

    const file = req.file;

    if (
      !name ||
      !priceperday ||
      ac === undefined ||
      !passengers ||
      !transmission ||
      !seats ||
      !doors ||
      !modelYear ||
      ratings === undefined ||
      reviews === undefined ||
      !fuelType ||
      !carNumber ||
      !from ||
      !to ||
      !permited_city ||
      !email
    ) {
      console.log("Missing required fields:", {
        name, priceperday, ac, passengers, transmission, seats, doors,
        modelYear, ratings, reviews, fuelType, carNumber, from, to, permited_city, email,
      });
      return res.status(400).json({
        message: "All fields are required",
        success: false,
      });
    }

    if (!file) {
      console.log("No file uploaded");
      return res.status(400).json({
        message: "Image file is required",
        success: false,
      });
    }

    const allowedTypes = ["image/png", "image/jpeg", "image/jpg"];
    if (!allowedTypes.includes(file.mimetype)) {
      console.log("Invalid file type:", file.mimetype);
      return res.status(400).json({
        message: "Image must be a PNG, JPG, or JPEG file",
        success: false,
      });
    }

    if (file.size > 5 * 1024 * 1024) {
      console.log("File too large:", file.size);
      return res.status(400).json({
        message: "Image size must not exceed 5MB",
        success: false,
      });
    }

    const carNumberRegex = /^[A-Z]{2}-\d{4}$/;
    if (!carNumberRegex.test(carNumber)) {
      console.log("Invalid car number:", carNumber);
      return res.status(400).json({
        message: "Car number must be in the format XX-1234 (e.g., AB-1234)",
        success: false,
      });
    }

    const validFuelTypes = ["Petrol", "Diesel", "Electric"];
    if (!validFuelTypes.includes(fuelType)) {
      console.log("Invalid fuel type:", fuelType);
      return res.status(400).json({
        message: "Fuel type must be one of: Petrol, Diesel, Electric",
        success: false,
      });
    }

    const validTransmissionTypes = ["Auto", "Manual"];
    if (!validTransmissionTypes.includes(transmission)) {
      console.log("Invalid transmission:", transmission);
      return res.status(400).json({
        message: "Transmission must be one of: Auto, Manual",
        success: false,
      });
    }

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

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      console.log("Invalid email:", email);
      return res.status(400).json({
        message: "Invalid email format",
        success: false,
      });
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (isNaN(fromDate.getTime())) {
      console.log("Invalid from date:", from);
      return res.status(400).json({
        message: "Invalid 'from' date format",
        success: false,
      });
    }
    if (isNaN(toDate.getTime())) {
      console.log("Invalid to date:", to);
      return res.status(400).json({
        message: "Invalid 'to' date format",
        success: false,
      });
    }

    const carData = {
      name: name.trim(),
      priceperday: Number(priceperday),
      ac: ac === "true",
      passengers: Number(passengers),
      transmission,
      seats: Number(seats),
      doors: Number(doors),
      modelYear: Number(modelYear),
      ratings: Number(ratings),
      reviews: Number(reviews),
      fuelType,
      image: `Uploads/${file.filename}`, // Updated to match User.controller.js destination
      carNumber: carNumber.trim().toUpperCase(),
      from: fromDate,
      to: toDate,
      permited_city,
      email: email.trim(),
    };

    console.log("Attempting to save car:", carData);
    const newCar = new Car(carData);
    const insertedCar = await newCar.save();
    console.log("Car saved successfully:", insertedCar._id);

    return res.status(201).json({
      message: "Car inserted successfully",
      success: true,
      data: insertedCar,
    });
  } catch (error) {
    console.error("Error inserting car:", {
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
        message: "Car number already exists",
        success: false,
      });
    }
    return res.status(500).json({
      message: "Failed to insert car",
      success: false,
      error: error.message,
    });
  }
});

Dashboard.put("/car-update/:id", authMiddleware, upload.single("file"), async (req, res) => {
  try {
    console.log("Received car-update request:", {
      params: req.params,
      body: req.body,
      file: req.file ? { filename: req.file.filename, mimetype: req.file.mimetype, size: req.file.size } : null,
    });

    const carId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(carId)) {
      console.log("Invalid car ID:", carId);
      return res.status(400).json({
        message: "Invalid car ID format",
        success: false,
      });
    }

    const carObjectId = new mongoose.Types.ObjectId(carId);
    const car = await Car.findById(carObjectId);
    if (!car) {
      console.log("Car not found for ID:", carId);
      return res.status(404).json({
        message: "Car not found",
        success: false,
      });
    }

    const {
      name,
      priceperday,
      ac,
      passengers,
      transmission,
      seats,
      doors,
      modelYear,
      ratings,
      reviews,
      fuelType,
      carNumber,
      from,
      to,
      permited_city,
    } = req.body;

    const file = req.file;

    const updatedCarData = {};

    // Validate and add fields only if provided
    if (name) updatedCarData.name = name.trim();
    if (priceperday !== undefined && priceperday !== "") {
      if (isNaN(priceperday) || Number(priceperday) < 0) {
        console.log("Invalid priceperday:", priceperday);
        return res.status(400).json({
          message: "Price per day must be a non-negative number",
          success: false,
        });
      }
      updatedCarData.priceperday = Number(priceperday);
    }
    if (ac !== undefined) updatedCarData.ac = ac === "true" || ac === true;
    if (passengers !== undefined && passengers !== "") {
      if (isNaN(passengers) || Number(passengers) < 1 || Number(passengers) > 8) {
        console.log("Invalid passengers:", passengers);
        return res.status(400).json({
          message: "Passengers must be between 1 and 8",
          success: false,
        });
      }
      updatedCarData.passengers = Number(passengers);
    }
    if (transmission) {
      const validTransmissions = ["Auto", "Manual"];
      if (!validTransmissions.includes(transmission)) {
        console.log("Invalid transmission:", transmission);
        return res.status(400).json({
          message: "Transmission must be one of: Auto, Manual",
          success: false,
        });
      }
      updatedCarData.transmission = transmission;
    }
    if (seats !== undefined && seats !== "") {
      if (isNaN(seats) || Number(seats) < 1 || Number(seats) > 8) {
        console.log("Invalid seats:", seats);
        return res.status(400).json({
          message: "Seats must be between 1 and 8",
          success: false,
        });
      }
      updatedCarData.seats = Number(seats);
    }
    if (doors !== undefined && doors !== "") {
      if (isNaN(doors) || Number(doors) < 2 || Number(doors) > 6) {
        console.log("Invalid doors:", doors);
        return res.status(400).json({
          message: "Doors must be between 2 and 6",
          success: false,
        });
      }
      updatedCarData.doors = Number(doors);
    }
    if (modelYear !== undefined && modelYear !== "") {
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
      updatedCarData.modelYear = Number(modelYear);
    }
    if (ratings !== undefined && ratings !== "") {
      if (isNaN(ratings) || Number(ratings) < 0 || Number(ratings) > 5) {
        console.log("Invalid ratings:", ratings);
        return res.status(400).json({
          message: "Ratings must be between 0 and 5",
          success: false,
        });
      }
      updatedCarData.ratings = Number(ratings);
    }
    if (reviews !== undefined && reviews !== "") {
      if (isNaN(reviews) || Number(reviews) < 0) {
        console.log("Invalid reviews:", reviews);
        return res.status(400).json({
          message: "Reviews must be a non-negative number",
          success: false,
        });
      }
      updatedCarData.reviews = Number(reviews);
    }
    if (fuelType) {
      const validFuelTypes = ["Petrol", "Diesel", "Electric"];
      if (!validFuelTypes.includes(fuelType)) {
        console.log("Invalid fuel type:", fuelType);
        return res.status(400).json({
          message: "Fuel type must be one of: Petrol, Diesel, Electric",
          success: false,
        });
      }
      updatedCarData.fuelType = fuelType;
    }
    if (carNumber) {
      const carNumberRegex = /^[A-Z]{2}-\d{4}$/;
      if (!carNumberRegex.test(carNumber.trim())) {
        console.log("Invalid car number:", carNumber);
        return res.status(400).json({
          message: "Car number must be in the format XX-1234 (e.g., AB-1234)",
          success: false,
        });
      }
      updatedCarData.carNumber = carNumber.trim().toUpperCase();
    }
    if (permited_city) {
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
      updatedCarData.permited_city = permited_city;
    }
    if (from || to) {
      const fromDate = from ? new Date(from) : car.from;
      const toDate = to ? new Date(to) : car.to;
      if (from && isNaN(fromDate.getTime())) {
        console.log("Invalid from date:", from);
        return res.status(400).json({
          message: "Invalid 'from' date format",
          success: false,
        });
      }
      if (to && isNaN(toDate.getTime())) {
        console.log("Invalid to date:", to);
        return res.status(400).json({
          message: "Invalid 'to' date format",
          success: false,
        });
      }
      if (from) updatedCarData.from = fromDate;
      if (to) updatedCarData.to = toDate;
    }
    if (file) {
      const allowedTypes = ["image/png", "image/jpeg", "image/jpg"];
      if (!allowedTypes.includes(file.mimetype)) {
        console.log("Invalid file type:", file.mimetype);
        return res.status(400).json({
          message: "Image must be a PNG, JPG, or JPEG file",
          success: false,
        });
      }
      if (file.size > 5 * 1024 * 1024) {
        console.log("File too large:", file.size);
        return res.status(400).json({
          message: "Image size must not exceed 5MB",
          success: false,
        });
      }
      if (car.image) {
        try {
          const oldImagePath = path.join(__dirname, "..", car.image);
          await fs.promises.unlink(oldImagePath);
          console.log("Old image deleted:", oldImagePath);
        } catch (err) {
          console.warn("Old image file could not be deleted:", err.message);
        }
      }
      updatedCarData.image = `Uploads/${file.filename}`;
    }

    if (Object.keys(updatedCarData).length === 0 && !file) {
      console.log("No fields provided for update:", carId);
      return res.status(400).json({
        message: "No valid fields provided for update",
        success: false,
      });
    }

    console.log("Updating car with data:", updatedCarData);
    const updatedCar = await Car.findByIdAndUpdate(
      carObjectId,
      { $set: updatedCarData },
      { new: true, runValidators: true }
    );

    if (!updatedCar) {
      console.log("Car update failed, not found:", carId);
      return res.status(404).json({
        message: "Car not found",
        success: false,
      });
    }

    // Update related requests
    const carNumberToMatch = updatedCarData.carNumber || car.carNumber;
    const matchingRequests = await Request.countDocuments({
      carNumber: carNumberToMatch,
    });

    if (matchingRequests > 0) {
      const requestUpdateData = {};
      if (updatedCarData.name) requestUpdateData.car_model = updatedCarData.name;
      if (updatedCarData.priceperday !== undefined) requestUpdateData.priceperday = updatedCarData.priceperday;
      if (updatedCarData.ac !== undefined) requestUpdateData.ac = updatedCarData.ac;
      if (updatedCarData.passengers !== undefined) requestUpdateData.passengers = updatedCarData.passengers;
      if (updatedCarData.transmission) requestUpdateData.transmission = updatedCarData.transmission;
      if (updatedCarData.seats !== undefined) requestUpdateData.seats = updatedCarData.seats;
      if (updatedCarData.doors !== undefined) requestUpdateData.doors = updatedCarData.doors;
      if (updatedCarData.modelYear !== undefined) requestUpdateData.modelYear = updatedCarData.modelYear;
      if (updatedCarData.ratings !== undefined) requestUpdateData.ratings = updatedCarData.ratings;
      if (updatedCarData.reviews !== undefined) requestUpdateData.reviews = updatedCarData.reviews;
      if (updatedCarData.fuelType) requestUpdateData.fuelType = updatedCarData.fuelType;
      if (updatedCarData.carNumber) requestUpdateData.carNumber = updatedCarData.carNumber;
      if (updatedCarData.permited_city) requestUpdateData.permited_city = updatedCarData.permited_city;
      if (updatedCarData.from) requestUpdateData.from = updatedCarData.from;
      if (updatedCarData.to) requestUpdateData.to = updatedCarData.to;
      if (updatedCarData.image) requestUpdateData.image = updatedCarData.image;

      const updateResult = await Request.updateMany(
        { carNumber: carNumberToMatch },
        { $set: requestUpdateData }
      );
      console.log(`Updated ${updateResult.modifiedCount} requests for carNumber: ${carNumberToMatch}`);
    } else {
      console.log("No related requests found for carNumber:", carNumberToMatch);
    }

    const baseUrl = process.env.BASE_URL || "https://be-go-rental-hbsq.onrender.com";
    const updatedCarResponse = updatedCar.toObject();
    if (updatedCarResponse.image) {
      updatedCarResponse.image = `${baseUrl}/${updatedCarResponse.image}`;
    }

    console.log("Car updated successfully:", updatedCar._id);
    return res.status(200).json({
      message: "Car and related requests updated successfully",
      success: true,
      data: updatedCarResponse,
    });
  } catch (error) {
    console.error("Error updating car:", {
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
        message: "Car number already exists",
        success: false,
      });
    }
    return res.status(500).json({
      message: "Failed to update car",
      success: false,
      error: error.message,
    });
  }
});

Dashboard.get("/cars/:id", authMiddleware, async (req, res) => {
  try {
    const carId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(carId)) {
      return res.status(400).json({
        message: "Invalid car ID format",
        success: false,
      });
    }
    const car = await Car.findById(carId);
    if (!car) {
      return res.status(404).json({
        message: "Car not found",
        success: false,
      });
    }
    const baseUrl =
      process.env.BASE_URL || "https://be-go-rental-hbsq.onrender.com/";
    const carResponse = car.toObject();
    if (carResponse.image) {
      carResponse.image = `${baseUrl}/${carResponse.image}`;
    }
    res.status(200).json({
      car: carResponse,
      success: true,
    });
  } catch (error) {
    console.error("Error fetching car:", error.message);
    res.status(500).json({
      message: "Error fetching car details",
      success: false,
      error: error.message,
    });
  }
});

Dashboard.post("/review-ratings", authMiddleware, async (req, res) => {
  const { name, userid, carid, review, rate } = req.body;
  if (!name || !userid || !carid || !review || !rate) {
    return res.status(400).json({
      message: "All fields are required!",
      success: false,
    });
  }
  try {
    const newReview = new Review({
      name,
      userId: userid,
      carId: carid,
      review,
      rating: rate,
    });
    await newReview.save();
    const reviews = await Review.find({ carId: carid });
    const averageRating =
      reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length || 0;
    await Car.findByIdAndUpdate(carid, {
      ratings: averageRating.toFixed(1),
      reviews: reviews.length,
    });
    return res.status(201).json({
      message: "Review submitted successfully!",
      success: true,
      data: newReview,
    });
  } catch (error) {
    console.error("Error saving review:", error);
    return res.status(500).json({
      message: error.message || "Failed to submit review",
      success: false,
    });
  }
});

Dashboard.get("/get-review-rating", async (req, res) => {
  const { carId } = req.query;
  if (!carId) {
    return res.json({
      message: "Car Id is Missing!!",
      success: false,
    });
  }
  try {
    const response = await Review.find({ carId });
    return res.json({
      message: "Fetched Successfully!!",
      data: response,
      success: true,
    });
  } catch (error) {
    return res.json({
      message: error.message,
      success: false,
    });
  }
});

Dashboard.post("/booking-cars-insert", authMiddleware, async (req, res) => {
  try {
    const request_data = await Request.find({ status: "approved" });

    if (request_data.length === 0) {
      return res.json({
        message: "No approved requests found.",
        success: false,
      });
    }

    const carsToInsert = [];
    for (let data of request_data) {
      const fromDate = parseDateString(data.from);
      const toDate = parseDateString(data.to);
      if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        console.warn(
          `Skipping request with invalid 'from' or 'to' dates for car number: ${data.carNumber}`
        );
        continue;
      }

      const carData = {
        name: data.car_model,
        modelYear: data.modelYear,
        priceperday: data.priceperday,
        transmission: data.transmission,
        ac: data.ac,
        passengers: data.passengers,
        seats: data.seats,
        doors: data.doors,
        image: data.image,
        ratings: data.ratings || 0,
        reviews: data.reviews || 0,
        fuelType: data.fuelType,
        carNumber: data.carNumber,
        from: fromDate,
        to: toDate,
        permited_city: data.permited_city,
      };

      const carNumberRegex = /^[A-Z]{2}-\d{4}$/;
      if (!carNumberRegex.test(carData.carNumber)) {
        console.warn(
          `Skipping request with invalid car number: ${carData.carNumber}`
        );
        continue;
      }

      const validFuelTypes = ["Petrol", "Diesel", "Electric"];
      const validTransmissions = ["Auto", "Manual"];
      if (
        !validFuelTypes.includes(carData.fuelType) ||
        !validTransmissions.includes(carData.transmission)
      ) {
        console.warn(
          `Skipping request with invalid fuelType or transmission: ${carData.fuelType}, ${carData.transmission}`
        );
        continue;
      }
      const validCities = [
        "chennai",
        "coimbatore",
        "madurai",
        "trichy",
        "hyderbad",
        "banglore",
        "kochi",
        "goa",
        "cdm",
      ];
      if (!validCities.includes(carData.permited_city)) {
        console.warn(
          `Skipping request with invalid permitted city: ${carData.permited_city}`
        );
        continue;
      }

      carsToInsert.push(carData);
    }

    if (carsToInsert.length === 0) {
      return res.json({
        message: "No valid approved requests to insert.",
        success: false,
      });
    }

    const insertedCars = await Car.insertMany(carsToInsert);

    return res.json({
      message: "Booking cars inserted successfully!",
      success: true,
      data: insertedCars,
    });
  } catch (error) {
    console.error("Error in booking-cars-insert:", error.message);
    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Validation failed",
        success: false,
        error: Object.values(error.errors).map((err) => err.message),
      });
    }
    if (error.code === 11000) {
      return res.status(400).json({
        message: "One or more car numbers already exist",
        success: false,
      });
    }
    return res.status(500).json({
      message: "Failed to insert booking cars",
      success: false,
      error: error.message,
    });
  }
});

Dashboard.delete("/car-delete/:id", authMiddleware, async (req, res) => {
  try {
    const carId = req.params.id;
    const car = await Car.findById(carId);
    if (!car) {
      return res.status(404).json({
        message: "Car not found",
        success: false,
      });
    }
    const imagePath = path.join(__dirname, "..", car.image);
    fs.unlink(imagePath, (err) => {
      if (err) {
        console.warn("Image file could not be deleted:", err.message);
      }
    });
    await Request.deleteMany({ carNumber: car.carNumber });
    await Car.findByIdAndDelete(carId);
    return res.status(200).json({
      message: "Car and associated requests deleted successfully",
      success: true,
    });
  } catch (error) {
    console.error("Error deleting car and requests:", error.message);
    return res.status(500).json({
      message: "Failed to delete car and associated requests",
      success: false,
      error: error.message,
    });
  }
});

Dashboard.get("/car-count", authMiddleware, async (req, res) => {
  const { email } = req.body;
  try {
    const count = await Car.countDocuments();
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

Dashboard.get("/car-count-renter", authMiddleware, async (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.json({
      message: "No email provided!",
      success: false,
    });
  }

  try {
    const count = await Car.countDocuments({ email });
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

module.exports = { Dashboard };
