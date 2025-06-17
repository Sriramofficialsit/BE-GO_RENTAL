const Express = require("express");
const Auth = Express.Router();
const User = require("../models/User.model");
const Profiledetails = require("../models/ProfileDetails.model");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const mongoose = require("mongoose");
const authMiddleware = require("../middleware/authmiddleware");
require("dotenv").config();
const multer = require("multer");
const path = require("path");

const transporter = nodemailer.createTransport({
  secure: true,
  host: "smtp.gmail.com",
  port: 465,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
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
Auth.post("/register", async (req, res) => {
  const { name, email, password, mobileno } = req.body;

  if (!name || !email || !password || !mobileno) {
    return res.status(400).json({
      message: "Please Provide All Informations",
      success: false,
    });
  }
  try {
    const existing_user = await User.findOne({ email });
    if (existing_user) {
      return res.status(400).json({
        message: "User Already Exist",
        success: false,
      });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const NewUser = new User({
      name,
      email,
      password: hashedPassword,
      mobileno,
    });
    await NewUser.save();
    return res.status(201).json({
      message: "User Registeration Sucessfull",
      success: true,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal Server Error",
      success: false,
      error: error.message,
    });
  }
});

const otpStore = new Map();

const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();
const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,}$/;
const emailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
const mobileRegex = /^[0-9]{10}$/;
// Combined route
Auth.post("/register-with-otp", async (req, res) => {
  const { step } = req.body;

  if (step === "send-otp") {
    const { name, email, password, mobileno } = req.body;

    if (!name || !email || !password || !mobileno) {
      return res
        .status(400)
        .json({ message: "All fields are required", success: false });
    }

    if (!emailRegex.test(email)) {
      return res
        .status(400)
        .json({ message: "Invalid email format", success: false });
    }

    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        message:
          "Password must be at least 8 characters long and contain at least one letter and one number",
        success: false,
      });
      if (!mobileRegex.test(mobileno)) {
        return res.status(400).json({
          message: "Mobile number must be 10 digits",
          success: false,
        });
      }
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User already exists", success: false });
    }

    const otp = generateOTP();
    const otpExpiry = Date.now() + 10 * 60 * 1000;

    otpStore.set(email, {
      otp,
      name,
      email,
      password,
      mobileno,
      expiresAt: otpExpiry,
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your OTP for Go Rental Registration",
      text: `Your OTP for registration is ${otp}. It is valid for 10 minutes.`,
    };

    try {
      await transporter.sendMail(mailOptions);
      return res
        .status(200)
        .json({ message: "OTP sent to your email", success: true });
    } catch (error) {
      return res.status(500).json({
        message: "Failed to send OTP",
        success: false,
        error: error.message,
      });
    }
  } else if (step === "verify-otp") {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res
        .status(400)
        .json({ message: "Email and OTP are required", success: false });
    }

    const storedData = otpStore.get(email);
    if (!storedData) {
      return res
        .status(400)
        .json({ message: "OTP not found or expired", success: false });
    }

    const { otp: storedOtp, expiresAt, name, password, mobileno } = storedData;

    if (Date.now() > expiresAt) {
      otpStore.delete(email);
      return res
        .status(400)
        .json({ message: "OTP has expired", success: false });
    }

    if (otp !== storedOtp) {
      return res.status(400).json({ message: "Invalid OTP", success: false });
    }

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = new User({
        name,
        email,
        password: hashedPassword,
        mobileno,
      });
      await newUser.save();
      otpStore.delete(email);
      return res
        .status(201)
        .json({ message: "User Registration Successful", success: true });
    } catch (error) {
      return res.status(500).json({
        message: "Internal Server Error",
        success: false,
        error: error.message,
      });
    }
  } else {
    return res.status(400).json({ message: "Invalid step", success: false });
  }
});

// Periodic cleanup
setInterval(() => {
  const now = Date.now();
  for (const [email, data] of otpStore.entries()) {
    if (now > data.expiresAt) {
      otpStore.delete(email);
    }
  }
}, 60 * 1000);

Auth.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({
        message: "Invalid User",
        success: false,
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid Username Or Password",
        success: false,
      });
    }

    const token = jwt.sign(
      { id: user._id, name: user.name, role: user.role, email: user.email },
      process.env.SECRET_KEY,
      { expiresIn: "1h" }
    );

    return res.status(200).json({
      message: "Login Successful",
      token,
      userId: user._id,
      role: user.role,
      email: user.email,
      name: user.name,
      success: true,
    });
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({
      message: "Internal Server Error",
      success: false,
    });
  }
});

Auth.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message: "User Not Found!!",
        success: false,
      });
    }

    const token = crypto.randomBytes(20).toString("hex");
    user.resetpasswordtoken = token;
    user.resetpasswordexpires = Date.now() + 60 * 60 * 1000;

    await user.save();

    const resetLink = `${process.env.FRONTEND_URL_USER}reset-password?token=${token}`;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: "Password Reset",
      html: `
          <p>Hello, ${user.name}. You requested a password reset.</p>
          <p>Click the link below to reset your password:</p>
          <a href="${resetLink}">Reset Your Password</a>
          <p>If you did not request this, please ignore this email. The link will expire in 1 hour.</p>
        `,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      message: "Password reset email sent successfully",
      success: true,
      token: token,
    });
  } catch (error) {
    res.status(503).json({
      message: "Something went wrong on the server side",
      success: false,
      error: error.message,
    });
  }
});

Auth.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    const user = await User.findOne({
      resetpasswordtoken: token,
      resetpasswordexpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired token",
        success: false,
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);

    user.resetpasswordtoken = undefined;
    user.resetpasswordexpires = undefined;

    await user.save();

    res.status(200).json({
      message: "Password successfully reset",
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      message: "Something went wrong on the server side",
      success: false,
      error: error.message,
    });
  }
});

Auth.get("/user-info", authMiddleware, async (req, res) => {
  try {
    const profile = await Profiledetails.find({});
    const user = await User.find({});
    if (!user && !profile) {
      return res.json({
        message: "User Not Auth",
        success: false,
      });
    }
    return res.json({
      profile: profile,
      user: user,
      success: true,
    });
  } catch (error) {
    return res.json({
      message: error.message,
      success: false,
    });
  }
});

Auth.delete("/user-and-info-del/:email", authMiddleware, async (req, res) => {
  const { email } = req.params;

  try {
    if (!email) {
      return res.status(400).json({
        message: "Email is required",
        success: false,
      });
    }

    const result1 = await User.deleteOne({ email });
    const result2 = await Profiledetails.deleteOne({ email });

    if (result1.deletedCount === 0 && result2.deletedCount === 0) {
      return res.status(404).json({
        message: "User not found",
        success: false,
      });
    }

    return res.status(200).json({
      message: "User deleted successfully",
      success: true,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
      success: false,
    });
  }
});

Auth.delete("/user-info-del/:email", authMiddleware, async (req, res) => {
  const { email } = req.params;

  try {
    if (!email) {
      return res.status(400).json({
        message: "Email is required",
        success: false,
      });
    }

    const result = await Profiledetails.deleteOne({ email });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        message: "User not found or already deleted",
        success: false,
      });
    }

    return res.status(200).json({
      message: "User deleted successfully",
      success: true,
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    return res.status(500).json({
      message: error.message,
      success: false,
    });
  }
});
Auth.put("/user-and-info-update/:email", authMiddleware, async (req, res) => {
  const { email } = req.params;
  const { name, mobileno, role, lastname, gender, phone, address, aadhaarNo } =
    req.body;

  try {
    if (!email) {
      return res.status(400).json({
        message: "Email is required",
        success: false,
      });
    }

    const userUpdate = await User.updateOne(
      { email },
      { $set: { name, mobileno, role } },
      { runValidators: true }
    );

    const profileUpdate = await Profiledetails.updateOne(
      { email },
      { $set: { name, lastname, gender, phone, address, aadhaarNo } },
      { runValidators: true }
    );

    if (userUpdate.matchedCount === 0 && profileUpdate.matchedCount === 0) {
      return res.status(404).json({
        message: "User or profile not found",
        success: false,
      });
    }

    return res.status(200).json({
      message: "User and profile updated successfully",
      success: true,
    });
  } catch (error) {
    console.error("Error updating user and profile:", error);
    return res.status(500).json({
      message: error.message,
      success: false,
    });
  }
});

Auth.put("/user-info-update/:email", authMiddleware, async (req, res) => {
  const { email } = req.params;
  const { name, lastname, gender, phone, address, aadhaarNo } = req.body;

  try {
    if (!email) {
      return res.status(400).json({
        message: "Email is required",
        success: false,
      });
    }

    const profileUpdate = await Profiledetails.updateOne(
      { email },
      { $set: { name, lastname, gender, phone, address, aadhaarNo } },
      { runValidators: true }
    );

    if (profileUpdate.matchedCount === 0) {
      return res.status(404).json({
        message: "Profile not found",
        success: false,
      });
    }

    return res.status(200).json({
      message: "Profile updated successfully",
      success: true,
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    return res.status(500).json({
      message: error.message,
      success: false,
    });
  }
});

Auth.get("/user-info-admin", authMiddleware, async (req, res) => {
  const { email } = req.query;
  try {
    const admin = await Profiledetails.findOne({ email });
    if (!admin) {
      return res.status(404).json({
        message: "User Not Found",
        success: false,
      });
    }

    return res.status(200).json({
      data: admin,
      success: true,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
      success: false,
    });
  }
});
Auth.post(
  "/update-user-info",
  authMiddleware,
  upload.single("aadhaar"),
  async (req, res) => {
    const { email } = req.query;
    const {
      name,
      lastname,
      gender,
      phone,
      address,
      aadhaarNo,
      email: bodyEmail,
    } = req.body;
    const aadhaarFile = req.file;

    try {
      if (!email) {
        return res.status(400).json({
          message: "Email is required in query parameter.",
          success: false,
        });
      }
      if (
        !name ||
        !lastname ||
        !gender ||
        !phone ||
        !address ||
        !aadhaarNo ||
        !bodyEmail
      ) {
        return res.status(400).json({
          message:
            "All fields (name, lastname, gender, phone, address, aadhaarNo, email) are required.",
          success: false,
        });
      }
      const emailRegex = /\S+@\S+\.\S+/;
      if (!emailRegex.test(bodyEmail)) {
        return res.status(400).json({
          message: "Invalid email format.",
          success: false,
        });
      }
      const aadhaarRegex = /^\d{12}$/;
      if (!aadhaarRegex.test(aadhaarNo)) {
        return res.status(400).json({
          message: "Aadhaar number must be a 12-digit number.",
          success: false,
        });
      }
      const phoneRegex = /^\d{10}$/;
      if (!phoneRegex.test(phone)) {
        return res.status(400).json({
          message: "Phone number must be a 10-digit number.",
          success: false,
        });
      }

      const validGenders = ["male", "female"];
      if (!validGenders.includes(gender.toLowerCase())) {
        return res.status(400).json({
          message: "Gender must be either 'male' or 'female'.",
          success: false,
        });
      }

      const existingProfile = await Profiledetails.findOne({ email });
      if (!existingProfile && !aadhaarFile) {
        return res.status(400).json({
          message: "Aadhaar document is required for new profiles.",
          success: false,
        });
      }
      let aadhaarFilePath = existingProfile?.aadhaarFile || "";
      if (aadhaarFile) {
        const allowedTypes = [
          "application/pdf",
          "image/png",
          "image/jpeg",
          "image/jpg",
        ];
        if (!allowedTypes.includes(aadhaarFile.mimetype)) {
          return res.status(400).json({
            message: "Aadhaar document must be a PDF, PNG, JPG, or JPEG file.",
            success: false,
          });
        }
        if (aadhaarFile.size > 10 * 1024 * 1024) {
          return res.status(400).json({
            message: "Aadhaar document size must not exceed 10MB.",
            success: false,
          });
        }
        aadhaarFilePath = `Uploads/${aadhaarFile.filename}`;
      }
      const updateData = {
        name: name.trim(),
        lastname: lastname.trim(),
        gender: gender.toLowerCase(),
        email: email.trim(),
        phone: phone.trim(),
        address: address.trim(),
        aadhaarNo: aadhaarNo.trim(),
        aadhaarFile: aadhaarFilePath,
      };

      const updatedRenter = await Profiledetails.findOneAndUpdate(
        { email },
        { $set: updateData },
        {
          new: true,
          upsert: true,
          runValidators: true,
        }
      );
      return res.status(200).json({
        message: "Renter profile updated successfully.",
        success: true,
        data: updatedRenter,
      });
    } catch (error) {
      console.error("Error in update-user-info:", {
        message: error.message,
        stack: error.stack,
      });
      return res.status(500).json({
        message: error.message || "Internal server error.",
        success: false,
      });
    }
  }
);

Auth.get("/user-count", authMiddleware, async (req, res) => {
  const { email } = req.body;
  // if (!email) {
  //   return res.json({
  //     message: "Email Not Found!",
  //     success: false,
  //   });
  // }
  try {
    const count = await User.countDocuments();
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

module.exports = { Auth, upload };
