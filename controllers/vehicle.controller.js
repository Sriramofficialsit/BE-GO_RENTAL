const express = require("express");
const vehicle = express.Router();
require("dotenv").config();
const Car = require("../models/Car.model");

vehicle.post("/car", async (req, res) => {
  const { name, modelYear, priceperday } = request.body;
});
