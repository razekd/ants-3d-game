const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let inputs = {};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  inputs[socket.id] = { x: 0, y: 0 };

  socket.on("input", (data) => {
    inputs[socket.id] = data;
    io.emit("allInputs", inputs);
    console.log("Current inputs:", inputs);
  });

  socket.on("disconnect", () => {
    delete inputs[socket.id];
    console.log("User disconnected:", socket.id);
  });
});

server.listen(4000, () => {
  console.log("Server running on http://localhost:4000");
});
