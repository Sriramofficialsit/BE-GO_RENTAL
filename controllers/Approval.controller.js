const express = require("express");
const Approvals = express.Router();
const Request = require("../models/Request.model");
const Car = require("../models/Car.model");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const authMiddleware = require("../middleware/authmiddleware");
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let folder = "Uploads/";
    if (file.fieldname === "rc_book") {
      folder += "rc";
    } else if (file.fieldname === "insurance") {
      folder += "insurance";
    } else if (file.fieldname === "image") {
      folder += "images";
    }
    fs.mkdirSync(folder, { recursive: true });
    cb(null, folder);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});
const fileFilter = (req, file, cb) => {
  if (file.fieldname === "image") {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed for the car image"), false);
    }
  } else {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(
        new Error("Only PDF files are allowed for rc_book and insurance"),
        false
      );
    }
  }
};
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
});
Approvals.post(
  "/requests-insert",
  authMiddleware,
  upload.fields([
    { name: "insurance", maxCount: 1 },
    { name: "rc_book", maxCount: 1 },
    { name: "image", maxCount: 1 },
  ]),
  async (req, res) => {
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
      return res.status(400).json({
        message:
          "All fields are required including PDFs, image, and permitted city!",
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

    try {
      const newRequest = new Request({
        name,
        email,
        phone,
        car_model,
        carNumber,
        modelYear,
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
        from,
        to,
        permited_city,
      });

      await newRequest.save();
      return res.status(201).json({
        message: "Request submitted successfully",
        success: true,
        data: newRequest,
      });
    } catch (error) {
      return res.status(500).json({
        message: error.message,
        success: false,
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

  try {
    const query = {};
    if (email) {
      query.email = email;
    }
    const data = await Request.find({ email });
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
    console.log(`Requests for status "${status}" with email "${email}":`, data);
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
const parseDateString = (dateString) => {
  const [day, month, year] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
};
Approvals.put("/approve/:id", authMiddleware, async (req, res) => {
  try {
    const request = await Request.findByIdAndUpdate(
      req.params.id,
      { status: "approved" },
      { new: true }
    );
    if (!request) {
      return res.status(404).json({
        message: "Request not found",
        success: false,
      });
    }
    const existingCar = await Car.findOne({ carNumber: request.carNumber });
    if (existingCar) {
      return res.status(400).json({
        message:
          "A car with this car number already exists in the Car collection",
        success: false,
      });
    }
    const fromDate = parseDateString(request.from);
    const toDate = parseDateString(request.to);
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return res.status(400).json({
        message: "Invalid 'from' or 'to' date format in the request",
        success: false,
      });
    }
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
    await newCar.save();
    return res.status(200).json({
      message: "Request approved and car added to Car collection successfully",
      success: true,
      data: request,
    });
  } catch (error) {
    console.error("Error in approve route:", error.message);
    return res.status(500).json({
      message: error.message,
      success: false,
    });
  }
});
Approvals.put("/disapprove/:id", authMiddleware, async (req, res) => {
  try {
    const request = await Request.findByIdAndUpdate(
      req.params.id,
      { status: "disapproved" },
      { new: true }
    );
    if (!request) {
      return res.status(404).json({
        message: "Request not found",
        success: false,
      });
    }
    return res.status(200).json({
      message: "Request disapproved successfully",
      success: true,
      data: request,
    });
  } catch (error) {
    console.error("Error in disapprove route:", error.message);
    return res.status(500).json({
      message: error.message,
      success: false,
    });
  }
});
Approvals.delete("/request-del/:id", authMiddleware, async (req, res) => {
  try {
    const deletedRequest = await Request.findByIdAndDelete(req.params.id);
    if (!deletedRequest) {
      return res.status(404).json({
        message: "Request not found",
        success: false,
      });
    }
    return res.status(200).json({
      message: "Request deleted successfully",
      success: true,
      data: deletedRequest,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
      success: false,
    });
  }
});
Approvals.get("/filter-get", authMiddleware, async (req, res) => {
  const { location, from, to } = req.query;

  if (!location || !from || !to) {
    return res.json({
      message: "All fields (location, from, to) are required!",
      success: false,
    });
  }

  try {
    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return res.json({
        message: "Invalid date format for 'from' or 'to'",
        success: false,
      });
    }

    const data = await Car.find({
      permited_city: location,
      from: { $lte: toDate },
      to: { $gte: fromDate },
      status: "available",
    });

    if (data.length === 0) {
      return res.json({
        data: [],
        message: "No available cars found for the specified criteria",
        success: true,
      });
    }

    return res.json({
      data: data,
      message: "Available cars fetched successfully!",
      success: true,
    });
  } catch (error) {
    console.error("Error fetching cars:", error.message);
    return res.json({
      message: "Failed to fetch cars: " + error.message,
      success: false,
    });
  }
});
Approvals.get("/request-get", authMiddleware, async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.json({
      message: "Email is required!!",
      success: false,
    });
  }
  try {
    const query = {};
    if (email) {
      query.email = email;
    }
    const data = await Request.find({ email });
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
module.exports = { Approvals };
