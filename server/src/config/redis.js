import Redis from "ioredis";
import { logger } from "../utils/logger.js";

let pub;
let sub;
let initialized = false;

export const initRedis = async () => {
  if (initialized) return;

  pub = new Redis(process.env.REDIS_URL || "redis://127.0.0.1:6379");
  sub = new Redis(process.env.REDIS_URL || "redis://127.0.0.1:6379");

  await Promise.all([
    new Promise((res) => pub.once("connect", res)),
    new Promise((res) => sub.once("connect", res)),
  ]);

  pub.on("error", (err) => logger.error(err, "Redis pub error"));
  sub.on("error", (err) => logger.error(err, "Redis sub error"));

  initialized = true;
};

const assertInitialized = () => {
  if (!initialized || !pub || !sub) {
    throw new Error("Redis not initialized. Call initRedis() first.");
  }
};

export const getRedisPub = () => {
  assertInitialized();
  return pub;
};

export const getRedisSub = () => {
  assertInitialized();
  return sub;
};