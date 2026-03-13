require("dotenv").config();

const express = require("express");
const cors = require("cors");
const http = require("http");

const menuRoutes = require("./routes/menuRoutes");
const orderRoutes = require("./routes/orderRoutes");
const setupSocket = require("./socket/socketHandler");

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Juice Bar API is running");
});

app.use("/api/menu-items", menuRoutes);
app.use("/api/orders", orderRoutes);

setupSocket(server);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});