const { Server } = require("socket.io");
const { setSocketInstance } = require("../controllers/orderController");
const { setSocketInstance: setMessageSocketInstance } = require("../controllers/messageController");

const setupSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL,
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