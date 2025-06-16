const Express = require("express");
const { dbconnect } = require("./DB");
const { Auth } = require("./controllers/User.controller");
require("dotenv").config();
const cors = require("cors");
const axios = require("axios");
const { Dashboard } = require("./controllers/Dashboard.controller");
const paymentRoutes = require("./routes/payment");
const ProfileRoutes = require("./routes/ProfileRoutes");
const { Approvals } = require("./controllers/Approval.controller");
const { Ticket } = require("./controllers/Ticket.controller");
const { Renter } = require("./controllers/Renter.controller");
const authMiddleware = require("./middleware/authmiddleware");
const go_rental = Express();

const corsOptions = {
  origin: [
    "https://go-rental-user.netlify.app",
    "https://go-rental-renter.netlify.app",
    "https://go-rental-admin.netlify.app",
  ],
  credentials: true,
};


go_rental.options("*", cors(corsOptions));
go_rental.use("*",cors());
go_rental.use(Express.json());
go_rental.use("/auth", Auth);
go_rental.use("/dashboard", Dashboard);
go_rental.use("/Renter", Renter);
go_rental.use("/api/profile", ProfileRoutes);
go_rental.use("/api/approvals", Approvals);
go_rental.use("/api/ticket", Ticket);
go_rental.use("/uploads", Express.static("uploads"));
go_rental.use("/images", Express.static("images"));
go_rental.use("/api/payment", paymentRoutes);
go_rental.get("/", (req, res) => {
  res.send("Go Rental Backend is Running!");
});
dbconnect();
const PORT = process.env.PORT || 3000;
const HOSTNAME = process.env.HOSTNAME || "localhost";
go_rental.get("/api/payments", authMiddleware, async (req, res) => {
  try {
    const response = await axios.get(
      "https://api.razorpay.com/v1/payments?count=100",
      {
        auth: {
          username: process.env.RAZORPAY_KEY_ID,
          password: process.env.RAZORPAY_KEY_SECRET,
        },
      }
    );

    const uniquePayments = Array.from(
      new Map(response.data.items.map((item) => [item.id, item])).values()
    );

    res.json({
      entity: "collection",
      count: uniquePayments.length,
      items: uniquePayments,
    });
  } catch (error) {
    console.error("Error fetching Razorpay payments:", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });
    res
      .status(error.response?.status || 500)
      .json({ error: "Failed to fetch payments" });
  }
});
go_rental.listen(PORT, () => {
  console.log(`Server Started At port ${PORT}`);
});
