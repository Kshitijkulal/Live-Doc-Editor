import { logger } from "../utils/logger.js";

export const errorHandler = (err, req, res, next) => {
  logger.error(
    {
      message: err.message,
      stack: err.stack,
      statusCode: err.statusCode || 500,
    },
    "Unhandled error"
  );

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
};