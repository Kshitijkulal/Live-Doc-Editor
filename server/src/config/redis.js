import Redis from "ioredis";
import { logger } from "../utils/logger.js";

// Right now Redis is only doing pub/sub for broadcasting Yjs updates across
// server instances. Was exploring it during the build and there's a lot more
// I want to do here - tracking active users, caching doc snapshots, maybe
// even moving presence state into Redis so horizontal scaling actually works.
// For now this gets the job done, will extend it as needed.

let pub;
let sub;
let initialized = false;

export const initRedis = async () => {
  if (initialized) return;

  pub = new Redis(process.env.REDIS_URL || "redis://127.0.0.1:6379");
  sub = new Redis(process.env.REDIS_URL || "redis://127.0.0.1:6379");

  // wait for both connections before proceeding - no point starting
  // the server if redis isn't ready
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