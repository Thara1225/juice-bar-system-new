require("dotenv").config();

const express = require("express");
const cors = require("cors");
const http = require("http");
const morgan = require("morgan");
const path = require("path");

const menuRoutes = require("./routes/menuRoutes");
const orderRoutes = require("./routes/orderRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const loyaltyRoutes = require("./routes/loyaltyRoutes");
const messageRoutes = require("./routes/messageRoutes");
const authRoutes = require("./routes/authRoutes");
const promoRoutes = require("./routes/promoRoutes");
const inventoryRoutes = require("./routes/inventoryRoutes");
const monitoringRoutes = require("./routes/monitoringRoutes");
const userRoutes = require("./routes/userRoutes");
const backupRoutes = require("./routes/backupRoutes");
const initDb = require("./config/initDb");
const { startBackupScheduler } = require("./services/backupScheduler");
const { initMqtt } = require("./services/mqttService");
const setupSocket = require("./socket/socketHandler");

const app = express();
const server = http.createServer(app);

const allowedOrigins = (process.env.CLIENT_URL || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

const devOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const corsOrigins = Array.from(new Set([...allowedOrigins, ...devOrigins]));

app.use(cors({
  origin: corsOrigins.length > 0 ? corsOrigins : true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
}));
app.use(morgan("combined"));
app.use(express.json({ limit: "8mb" }));

app.get("/", (req, res) => {
  res.send("Juice Bar API is running");
});

app.use("/api/menu-items", menuRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/loyalty", loyaltyRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/promotions", promoRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/backups", backupRoutes);
app.use("/api/monitoring", monitoringRoutes);

const clientDistPath = path.join(__dirname, "../../client/dist");
app.use(express.static(clientDistPath));

app.get(/^\/(?!api|socket\.io).*/, (req, res) => {
  res.sendFile(path.join(clientDistPath, "index.html"));
});

setupSocket(server);

const PORT = process.env.PORT || 5000;

initDb()
  .then(() => {
    startBackupScheduler();
    initMqtt();

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize database:", error.message);
    process.exit(1);
  });