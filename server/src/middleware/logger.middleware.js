import pinoHttp from "pino-http";
import { logger } from "../utils/logger.js";

export const httpLogger = pinoHttp({
  logger,
});