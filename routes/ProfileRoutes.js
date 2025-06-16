const express = require("express");
const multer = require("multer");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const ProfileDetails = require("../models/ProfileDetails.model");
const User = require("../models/User.model");
const router = express.Router();

require("dotenv").config();

const uploadDir = "uploads/";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error("Only JPEG, PNG, and PDF files are allowed!"), false);
    }
    cb(null, true);
  },
}).fields([
  { name: "aadhaar", maxCount: 1 },
  { name: "drivinglicence", maxCount: 1 },
]);

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
};

router.put("/save", verifyToken, upload, async (req, res) => {
  try {
    const {
      name,
      lastname,
      gender,
      email,
      phone,
      address,
      aadhaarNo,
      drivingLicenceNo,
    } = req.body;

    if (
      !name ||
      !lastname ||
      !gender ||
      !email ||
      !phone ||
      !address ||
      !aadhaarNo ||
      !drivingLicenceNo
    ) {
      return res.status(400).json({ error: "All fields are required!" });
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({ error: "Invalid email format!" });
    }

    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({ error: "Phone number must be 10 digits!" });
    }

    if (!/^\d{12}$/.test(aadhaarNo)) {
      return res
        .status(400)
        .json({ error: "Aadhaar number must be 12 digits!" });
    }

    const user = await User.findOne({ email: req.user.email });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    let aadhaarFile = req.files?.aadhaar?.[0]?.path || null;
    let drivingLicenceFile = req.files?.drivinglicence?.[0]?.path || null;

    let profile = await ProfileDetails.findOne({ user: user._id });
    if (profile) {
      
      if (!aadhaarFile && profile.aadhaarFile) {
        aadhaarFile = profile.aadhaarFile;
      }
      if (!drivingLicenceFile && profile.drivingLicenceFile) {
        drivingLicenceFile = profile.drivingLicenceFile;
      }

      profile.name = name;
      profile.lastname = lastname;
      profile.gender = gender;
      profile.email = email;
      profile.phone = phone;
      profile.address = address;
      profile.aadhaarNo = aadhaarNo;
      profile.drivingLicenceNo = drivingLicenceNo;
      profile.aadhaarFile = aadhaarFile;
      profile.drivingLicenceFile = drivingLicenceFile;
      await profile.save();
    } else {
      if (!aadhaarFile || !drivingLicenceFile) {
        return res.status(400).json({
          error:
            "Both Aadhaar and Driving Licence files are required for new profiles!",
        });
      }

      profile = new ProfileDetails({
        user: user._id,
        name,
        lastname,
        gender,
        email,
        phone,
        address,
        aadhaarNo,
        drivingLicenceNo,
        aadhaarFile,
        drivingLicenceFile,
      });
      await profile.save();

      user.profile = profile._id;
      await user.save();
    }

    res.status(200).json({ message: "Profile updated successfully", profile });
  } catch (error) {
    console.error("Error saving profile:", error.message);
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      res.status(400).json({ error: `${field} already exists!` });
    } else {
      res.status(500).json({ error: "Error saving profile: " + error.message });
    }
  }
});

router.get("/get", verifyToken, async (req, res) => {
  try {
    const email = req.user.email;
    if (!email) {
      return res
        .status(400)
        .json({ error: "Email is required to fetch profile" });
    }

    const user = await User.findOne({ email }).populate("profile");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const profile = user.profile || {};
    res.status(200).json({ profile });
  } catch (error) {
    console.error("Error fetching profile:", error.message);
    res
      .status(500)
      .json({ error: "Failed to fetch profile: " + error.message });
  }
});

module.exports = router;
