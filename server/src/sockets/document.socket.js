import { logger } from "../utils/logger.js";
import { validate } from "../utils/validate.js";
import { socketAsyncHandler } from "../utils/socketAsyncHandler.js";
import { applyUpdate, getDocument} from "../services/document.service.js";

const activeUsers = new Map(); // socketId -> user info

export const registerDocumentSocket = (io) => {
  io.on("connection", (socket) => {
    logger.info({ socketId: socket.id }, "Client connected");

    let currentUser = null;

    // client sends their user info when they want to join.
    // we send back the full Yjs state so they can hydrate their editor.
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

        // send the full Yjs binary state - client applies this to their local doc
        const state = getDocument();

        this.emit("document_state", {
          success: true,
          type: "DOCUMENT_STATE",
          data: state,
        });

        // let everyone know who's online
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

    // incoming Yjs CRDT delta from a client.
    // we apply it server-side (for persistence) and fan it out to peers.
    // no conflict resolution needed - Yjs handles that for us, which is
    // honestly the whole reason we went with CRDTs in the first place.
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

        await applyUpdate(update, this.id);

        // only broadcast the delta, not the full doc
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

    // just a relay - client says "i'm typing", we tell everyone else
    socket.on("typing", () => {
      if (!currentUser) return;

      socket.to("document_room").emit("user_typing", {
        user: currentUser,
      });
    });

    // cursor positions, forwarding to peers for the cursor overlay.
    // not doing anything fancy with this yet but the plumbing is here.
    socket.on("cursor_update", (cursor) => {
      if (!currentUser) return;

      socket.to("document_room").emit("cursor_update", {
        user: currentUser,
        cursor,
      });
    });

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