import http from "http";
import { Server } from "socket.io";
import app from "./src/app.js";
import { registerDocumentSocket } from "./src/sockets/document.socket.js";
import { logger } from "./src/utils/logger.js";

const PORT = 8080;

const server = http.createServer(app);

// attach socket server
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// register socket events
registerDocumentSocket(io);

server.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`);
});