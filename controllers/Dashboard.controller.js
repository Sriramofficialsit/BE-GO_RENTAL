const Express = require("express");
const Dashboard = Express.Router();
const Car = require("../models/Car.model");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Request = require("../models/Request.model");
const mongoose = require("mongoose");
const Review = require("../models/Review.model");
const authMiddleware = require("../middleware/authmiddleware");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/images");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const fileTypes = /pdf|png|jpg|jpeg/;
    const extname = fileTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = fileTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error("Only PDF, PNG, JPG, and JPEG files are allowed!"));
    }
  },
});
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
Dashboard.post(
  "/car-insert",
  authMiddleware,
  upload.single("image"),
  async (req, res) => {
    try {
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

      const imageFilePath = req.file;

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
        return res.status(400).json({
          message: "All fields are required",
          success: false,
        });
      }

      if (!imageFile) {
        return res.status(400).json({
          message: "Image file is required",
          success: false,
        });
      }

      const allowedTypes = ["image/png", "image/jpeg", "image/jpg"];
      if (!allowedTypes.includes(imageFile.mimetype)) {
        return res.status(400).json({
          message: "Image must be a PNG, JPG, or JPEG file",
          success: false,
        });
      }

      if (imageFile.size > 5 * 1024 * 1024) {
        // 5MB limit
        return res.status(400).json({
          message: "Image size must not exceed 5MB",
          success: false,
        });
      }

      const carNumberRegex = /^[A-Z]{2}-\d{4}$/;
      if (!carNumberRegex.test(carNumber)) {
        return res.status(400).json({
          message: "Number must be in the format XX-1234 (e.g., AB-1234)",
          success: false,
        });
      }

      const validFuelTypes = ["Petrol", "Diesel", "Electric"];
      if (!validFuelTypes.includes(fuelType)) {
        return res.status(400).json({
          message: "Fuel type must be one of: Petrol, Diesel, Electric",
          success: false,
        });
      }

      const validTransmissionTypes = ["Auto", "Manual"];
      if (!validTransmissionTypes.includes(transmission)) {
        return res.status(400).json({
          message: "Transmission must be one of: Auto, Manual",
          success: false,
        });
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
      if (!validCities.includes(permited_city)) {
        return res.status(400).json({
          message: `Permitted city must be one of: ${validCities.join(", ")}`,
          success: false,
        });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({
          message: "Invalid email format",
          success: false,
        });
      }

      const fromDate = new Date(from);
      const toDate = new Date(to);
      if (isNaN(fromDate.getTime())) {
        return res.status(400).json({
          message: "Invalid 'from' date format",
          success: false,
        });
      }
      if (isNaN(toDate.getTime())) {
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
        image: `Uploads/images/${imageFile.filename}`,
        carNumber: carNumber.trim().toUpperCase(),
        from: fromDate,
        to: toDate,
        permited_city,
        email: email.trim(),
      };

      const newCar = new Car(carData);
      const insertedCar = await newCar.save();

      return res.status(201).json({
        message: "Car inserted successfully",
        success: true,
        data: insertedCar,
      });
    } catch (error) {
      console.error("Error inserting car:", {
        message: error.message,
        stack: error.stack,
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
  }
);
Dashboard.put(
  "/car-update/:id",
  authMiddleware,
  upload.single("image"),
  async (req, res) => {
    try {
      const carId = req.params.id;
      if (!mongoose.Types.ObjectId.isValid(carId)) {
        return res.status(400).json({
          message: "Invalid car ID format",
          success: false,
        });
      }

      const carObjectId = new mongoose.Types.ObjectId(carId);
      const car = await Car.findById(carObjectId);
      if (!car) {
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

      const imageFile = req.file;

      // Validate image file if provided
      if (imageFile) {
        const allowedTypes = ["image/png", "image/jpeg", "image/jpg"];
        if (!allowedTypes.includes(imageFile.mimetype)) {
          return res.status(400).json({
            message: "Image must be a PNG, JPG, or JPEG file",
            success: false,
          });
        }
        if (imageFile.size > 5 * 1024 * 1024) {
          return res.status(400).json({
            message: "Image size must not exceed 5MB",
            success: false,
          });
        }
      }

      const updatedCarData = {};
      if (name) updatedCarData.name = name.trim();
      if (priceperday !== undefined) {
        if (isNaN(priceperday) || Number(priceperday) < 0) {
          return res.status(400).json({
            message: "Price per day must be a non-negative number",
            success: false,
          });
        }
        updatedCarData.priceperday = Number(priceperday);
      }
      if (ac !== undefined) updatedCarData.ac = ac === "true";
      if (passengers !== undefined) {
        if (
          isNaN(passengers) ||
          Number(passengers) < 1 ||
          Number(passengers) > 8
        ) {
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
          return res.status(400).json({
            message: "Transmission must be one of: Auto, Manual",
            success: false,
          });
        }
        updatedCarData.transmission = transmission;
      }
      if (seats !== undefined) {
        if (isNaN(seats) || Number(seats) < 1 || Number(seats) > 8) {
          return res.status(400).json({
            message: "Seats must be between 1 and 8",
            success: false,
          });
        }
        updatedCarData.seats = Number(seats);
      }
      if (doors !== undefined) {
        if (isNaN(doors) || Number(doors) < 2 || Number(doors) > 6) {
          return res.status(400).json({
            message: "Doors must be between 2 and 6",
            success: false,
          });
        }
        updatedCarData.doors = Number(doors);
      }
      if (modelYear !== undefined) {
        if (
          isNaN(modelYear) ||
          Number(modelYear) < 1900 ||
          Number(modelYear) > new Date().getFullYear() + 1
        ) {
          return res.status(400).json({
            message: `Model year must be between 1900 and ${
              new Date().getFullYear() + 1
            }`,
            success: false,
          });
        }
        updatedCarData.modelYear = Number(modelYear);
      }
      if (ratings !== undefined) {
        if (isNaN(ratings) || Number(ratings) < 0 || Number(ratings) > 5) {
          return res.status(400).json({
            message: "Ratings must be between 0 and 5",
            success: false,
          });
        }
        updatedCarData.ratings = Number(ratings);
      }
      if (reviews !== undefined) {
        if (isNaN(reviews) || Number(reviews) < 0) {
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
          return res.status(400).json({
            message: "Car number must be in the format XX-1234 (e.g., AB-1234)",
            success: false,
          });
        }
        updatedCarData.carNumber = carNumber.trim().toUpperCase();
      }
      if (permited_city) {
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
        if (!validCities.includes(permited_city)) {
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
          return res.status(400).json({
            message: "Invalid 'from' date format",
            success: false,
          });
        }
        if (to && isNaN(toDate.getTime())) {
          return res.status(400).json({
            message: "Invalid 'to' date format",
            success: false,
          });
        }
        if (from) updatedCarData.from = fromDate;
        if (to) updatedCarData.to = toDate;
      }
      if (imageFile) {
        if (car.image) {
          try {
            const oldImagePath = path.join(
              __dirname,
              "..",
              "public",
              car.image
            );
            await fs.unlink(oldImagePath);
          } catch (err) {
            console.warn("Old image file could not be deleted:", err.message);
          }
        }
        updatedCarData.image = `Uploads/images/${imageFile.filename}`;
      }

      const updatedCar = await Car.findByIdAndUpdate(
        carObjectId,
        { $set: updatedCarData },
        { new: true, runValidators: true }
      );

      if (!updatedCar) {
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
        const requestUpdateData = {
          car_model: updatedCar.name,
          priceperday: updatedCar.priceperday,
          ac: updatedCar.ac,
          passengers: updatedCar.passengers,
          transmission: updatedCar.transmission,
          seats: updatedCar.seats,
          doors: updatedCar.doors,
          modelYear: updatedCar.modelYear,
          ratings: updatedCar.ratings,
          reviews: updatedCar.reviews,
          fuelType: updatedCar.fuelType,
          carNumber: updatedCar.carNumber,
          permited_city: updatedCar.permited_city,
        };
        if (updatedCarData.from) requestUpdateData.from = updatedCarData.from;
        if (updatedCarData.to) requestUpdateData.to = updatedCarData.to;
        if (updatedCarData.image)
          requestUpdateData.image = updatedCarData.image;

        const updateResult = await Request.updateMany(
          { carNumber: carNumberToMatch },
          { $set: requestUpdateData }
        );

        if (updateResult.modifiedCount === 0) {
          console.warn("No requests were modified. Check schema alignment.");
        }
      }

      const baseUrl =
        process.env.BASE_URL || "https://be-go-rental-hbsq.onrender.com";
      const updatedCarResponse = updatedCar.toObject();
      if (updatedCarResponse.image) {
        updatedCarResponse.image = `${baseUrl}/${updatedCarResponse.image}`;
      }

      return res.status(200).json({
        message: "Car and related requests updated successfully",
        success: true,
        data: updatedCarResponse,
      });
    } catch (error) {
      console.error("Error updating car:", {
        message: error.message,
        stack: error.stack,
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
  }
);
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
    const baseUrl = process.env.BASE_URL || "http://localhost:3000/";
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
      message: "Fethed Successfuly!!",
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
