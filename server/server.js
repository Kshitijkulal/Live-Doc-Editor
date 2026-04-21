import http from "http";
import { Server } from "socket.io";
import app from "./src/app.js";
import { registerDocumentSocket } from "./src/sockets/document.socket.js";
import { logger } from "./src/utils/logger.js";
import { initRedis } from "./src/config/redis.js";
import { initYDoc } from "./src/services/document.service.js";

const PORT = 8080;

const server = http.createServer(app);

// socket.io setup - cors is wide open for dev, will lock this down later
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// redis first, then ydoc, then sockets. order matters here.
initRedis()
  .then(() => initYDoc())
  .then(() => {
    registerDocumentSocket(io);

    server.listen(PORT, () => {
      logger.info(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    logger.error(err, "Failed to start server");
    process.exit(1);
  });