export const socketAsyncHandler = (handler) => {
  return async function (...args) {
    const socket = this;

    try {
      await handler.apply(socket, args);
    } catch (err) {
      socket.emit("socket_error", {
        success: false,
        type: "SERVER_ERROR",
        message: err.message,
      });
    }
  };
};