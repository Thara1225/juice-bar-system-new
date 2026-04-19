const { Server } = require("socket.io");
const { setSocketInstance } = require("../controllers/orderController");
const { setSocketInstance: setMessageSocketInstance } = require("../controllers/messageController");

const allowedOrigins = (process.env.CLIENT_URL || "")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

const devOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const socketOrigins = Array.from(new Set([...allowedOrigins, ...devOrigins]));

const setupSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: socketOrigins.length > 0 ? socketOrigins : true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    },
  });

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  setSocketInstance(io);
  setMessageSocketInstance(io);
};

module.exports = setupSocket;