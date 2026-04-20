import { prisma } from "../config/prisma.js";
import { logger } from "../utils/logger.js";
import { AppError } from "../utils/AppError.js";
import * as Y from "yjs";
import { getRedisPub, getRedisSub } from "../config/redis.js";

let ydoc;
let yText;
let documentId;

const CHANNEL = "yjs_updates";
const INSTANCE_ID = process.pid;

let redisSubscribed = false;

// 🔹 INIT
export const initYDoc = async () => {
  ydoc = new Y.Doc();
  yText = ydoc.getText("content");

  const doc = await prisma.document.findFirst();

  if (!doc) {
    throw new AppError("Document not initialized", 500);
  }

  documentId = doc.id;

  // Load state
  if (doc.content) {
    try {
      Y.applyUpdate(ydoc, new Uint8Array(JSON.parse(doc.content)));
    } catch {
      yText.insert(0, doc.content);
    }
  }

  const sub = getRedisSub();

  if (!redisSubscribed) {
    await sub.subscribe(CHANNEL);

    sub.on("message", (_, message) => {
      try {
        const { update, instanceId } = JSON.parse(message);

        if (instanceId === INSTANCE_ID) return;

        Y.applyUpdate(ydoc, new Uint8Array(update));
      } catch (err) {
        logger.error(err, "Redis message failed");
      }
    });

    redisSubscribed = true;
  }

  logger.info({ documentId }, "Yjs initialized with Redis");
};

// 🔹 GET
export const getDocument = () => {
  return {
    content: Array.from(Y.encodeStateAsUpdate(ydoc)),
  };
};

// 🔹 APPLY UPDATE
export const applyUpdate = async (update, updatedBy) => {
  if (!update) {
    throw new AppError("Invalid update payload", 400);
  }

  const uint8 = new Uint8Array(update);

  Y.applyUpdate(ydoc, uint8);

  const pub = getRedisPub();

  await pub.publish(
    CHANNEL,
    JSON.stringify({
      update,
      instanceId: INSTANCE_ID,
    })
  );

  await persist(updatedBy);

  logger.info({ updatedBy }, "Yjs update applied");
};

// 🔹 PERSIST
const persist = async (updatedBy) => {
  const snapshot = Y.encodeStateAsUpdate(ydoc);

  await prisma.document.update({
    where: { id: documentId },
    data: {
      content: JSON.stringify(Array.from(snapshot)),
      updatedBy,
    },
  });
};