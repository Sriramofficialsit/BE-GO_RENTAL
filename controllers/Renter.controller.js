const Renter = require("express").Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const mongoose = require("mongoose");
const User = require("../models/User.model");
const Profiledetails = require("../models/ProfileDetails.model");
const authMiddleware = require("../middleware/authmiddleware");
const transporter = nodemailer.createTransport({
  secure: true,
  host: "smtp.gmail.com",
  port: 465,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});
Renter.post("/register", async (req, res) => {
  const { name, email, password, mobileno } = req.body;

  if (!name || !email || !password || !mobileno) {
    return res.status(400).json({
      message: "Please provide all required information",
      success: false,
    });
  }

  try {
    const existing_user = await User.findOne({ email });
    if (existing_user) {
      return res.status(400).json({
        message: "User already exists",
        success: false,
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      mobileno,
      role: "renter",
    });

    await newUser.save();

    return res.status(201).json({
      message: "Renter registration successful",
      success: true,
    });
  } catch (error) {
    console.error("Registration Error:", error);
    return res.status(500).json({
      message: "Internal server error",
      success: false,
      error: error.message,
    });
  }
});
Renter.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      message: "Please provide email and password",
      success: false,
    });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({
        message: "Invalid credentials",
        success: false,
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid credentials",
        success: false,
      });
    }

    if (user.role !== "renter") {
      return res.status(403).json({
        message: "Access denied. Not a renter.",
        success: false,
      });
    }

    const token = jwt.sign(
      { id: user._id, name: user.name, role: user.role, email: user.email },
      process.env.SECRET_KEY,
      { expiresIn: "1h" }
    );

    return res.status(200).json({
      message: "Login successful",
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
      message: "Internal server error",
      success: false,
      error: error.message,
    });
  }
});
Renter.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      message: "Please provide an email",
      success: false,
    });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
        success: false,
      });
    }

    if (user.role !== "renter") {
      return res.status(403).json({
        message: "Access denied. Not a renter.",
        success: false,
      });
    }

    const token = crypto.randomBytes(20).toString("hex");
    user.resetpasswordtoken = token;
    user.resetpasswordexpires = Date.now() + 60 * 60 * 1000;

    await user.save();

    const resetLink = `${process.env.FRONTEND_URL_RENTER}/reset-password?token=${token}`;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: "Password Reset for Renter Account",
      html: `
        <p>Hello, ${user.name}. You requested a password reset for your renter account.</p>
        <p>Click the link below to reset your password:</p>
        <a href="${resetLink}">Reset Your Password</a>
        <p>If you did not request this, please ignore this email. The link will expire in 1 hour.</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      message: "Password reset email sent successfully",
      success: true,
    });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    res.status(500).json({
      message: "Internal server error",
      success: false,
      error: error.message,
    });
  }
});
Renter.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({
      message: "Please provide token and new password",
      success: false,
    });
  }

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

    if (user.role !== "renter") {
      return res.status(403).json({
        message: "Access denied. Not a renter.",
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
    console.error("Reset Password Error:", error);
    res.status(500).json({
      message: "Internal server error",
      success: false,
      error: error.message,
    });
  }
});

module.exports = { Renter };
