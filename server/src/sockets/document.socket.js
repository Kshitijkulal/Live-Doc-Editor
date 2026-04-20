import { logger } from "../utils/logger.js";
import { validate } from "../utils/validate.js";
import { socketAsyncHandler } from "../utils/socketAsyncHandler.js";
import { applyUpdate, getDocument} from "../services/document.service.js";

const activeUsers = new Map(); // socketId -> user

export const registerDocumentSocket = (io) => {
  io.on("connection", (socket) => {
    logger.info({ socketId: socket.id }, "Client connected");

    let currentUser = null;

    // 🔹 JOIN DOCUMENT (WITH USER)
    socket.on(
      "join_document",
      socketAsyncHandler(async function (user) {
        if (!user || !user.id) {
          return this.emit("socket_error", {
            success: false,
            message: "User identity required",
          });
        }

        currentUser = user;
        activeUsers.set(socket.id, user);

        socket.join("document_room");

        // 🔥 send Yjs state instead of plain doc
        const state = getDocument();

        this.emit("document_state", {
          success: true,
          type: "DOCUMENT_STATE",
          data: state,
        });

        // 🔹 presence broadcast (unchanged)
        io.to("document_room").emit(
          "presence_update",
          Array.from(activeUsers.values())
        );

        logger.info(
          { socketId: socket.id, user: user.name },
          "User joined document"
        );
      })
    );

    // 🔹 YJS UPDATE (REPLACES edit_document)
    socket.on(
      "yjs_update",
      socketAsyncHandler(async function (update) {
        if (!update) {
          return this.emit("socket_error", {
            success: false,
            type: "VALIDATION_ERROR",
            message: "No update provided",
          });
        }

        // 🔥 apply CRDT update (NO conflicts anymore)
        await applyUpdate(update, this.id);

        // 🔥 broadcast ONLY delta (not full doc)
        socket.to("document_room").emit("yjs_update", {
          update,
          user: currentUser,
        });

        logger.info(
          { socketId: this.id, user: currentUser?.name },
          "Yjs update applied"
        );
      })
    );

    // 🔹 TYPING EVENT (UNCHANGED)
    socket.on("typing", () => {
      if (!currentUser) return;

      socket.to("document_room").emit("user_typing", {
        user: currentUser,
      });
    });

    // 🔹 CURSOR (NEW — REAL FEATURE)
    socket.on("cursor_update", (cursor) => {
      if (!currentUser) return;

      socket.to("document_room").emit("cursor_update", {
        user: currentUser,
        cursor,
      });
    });

    // 🔹 DISCONNECT (UNCHANGED)
    socket.on("disconnect", () => {
      if (currentUser) {
        activeUsers.delete(socket.id);

        io.to("document_room").emit(
          "presence_update",
          Array.from(activeUsers.values())
        );

        logger.info(
          { socketId: socket.id, user: currentUser.name },
          "User disconnected"
        );
      } else {
        logger.info({ socketId: socket.id }, "Client disconnected");
      }
    });
  });
};