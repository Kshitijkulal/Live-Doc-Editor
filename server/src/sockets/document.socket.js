import { getDocument, updateDocument } from "../services/document.service.js";
import { logger } from "../utils/logger.js";
import { validate } from "../utils/validate.js";
import { editDocumentSchema } from "../validators/document.validator.js";
import { socketAsyncHandler } from "../utils/socketAsyncHandler.js";

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

        // send doc
        const doc = await getDocument();

        this.emit("document_state", {
          success: true,
          type: "DOCUMENT_STATE",
          data: doc,
        });

        // broadcast presence
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

    // 🔹 EDIT DOCUMENT
    socket.on(
      "edit_document",
      socketAsyncHandler(async function (data) {
        if (!data) {
          return this.emit("socket_error", {
            success: false,
            type: "VALIDATION_ERROR",
            message: "No payload provided",
          });
        }

        const validation = validate(editDocumentSchema, data);

        if (!validation.success) {
          logger.warn(
            { socketId: this.id, errors: validation.errors },
            "Validation failed"
          );

          return this.emit("socket_error", {
            success: false,
            type: "VALIDATION_ERROR",
            message: "Invalid input",
            errors: validation.errors,
          });
        }

        const { content, version } = validation.data;

        const result = await updateDocument(content, version, this.id);

        if (result.noop) {
          return this.emit("document_noop", {
            success: true,
            type: "DOCUMENT_NOOP",
            data: result.data,
          });
        }

        if (result.conflict) {
          return this.emit("document_conflict", {
            success: false,
            type: "DOCUMENT_CONFLICT",
            data: result.data,
          });
        }

        io.to("document_room").emit("document_updated", {
          success: true,
          type: "DOCUMENT_UPDATE",
          data: result.data,
        });
      })
    );

    // 🔹 TYPING EVENT
    socket.on("typing", () => {
      if (!currentUser) return;

      socket.to("document_room").emit("user_typing", {
        user: currentUser,
      });
    });

    // 🔹 DISCONNECT
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