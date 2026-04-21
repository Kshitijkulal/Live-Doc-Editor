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

let persistTimeout = null;
let lastUpdatedBy = null;

// debounced persist - every keystroke doesn't need a db write.
// 2s feels right, fast enough that you don't lose much on a crash,
// slow enough that mongo isn't getting hammered on every character.
const schedulePersist = (updatedBy) => {
  lastUpdatedBy = updatedBy;

  clearTimeout(persistTimeout);

  persistTimeout = setTimeout(async () => {
    const snapshot = Y.encodeStateAsUpdate(ydoc);

    await prisma.document.update({
      where: { id: documentId },
      data: {
        content: JSON.stringify(Array.from(snapshot)),
        updatedBy: lastUpdatedBy,
      },
    });

    logger.info("Persisted debounced snapshot");
  }, 2000);
};

// loads the doc from mongo and hydrates the in-memory Yjs doc.
// called once on server boot before anything else touches the doc.
export const initYDoc = async () => {
  if (ydoc) return;
  ydoc = new Y.Doc();
  yText = ydoc.getText("content");

  const doc = await prisma.document.findFirst();

  if (!doc) {
    throw new AppError("Document not initialized", 500);
  }

  documentId = doc.id;

  // try to restore from the binary Yjs snapshot first.
  // if it's not valid Yjs data (e.g. plain text from an old seed),
  // fall back to just inserting the raw string into the Y.Text.
  if (doc.content) {
    try {
      Y.applyUpdate(ydoc, new Uint8Array(JSON.parse(doc.content)));
    } catch {
      yText.insert(0, doc.content);
    }
  }

  const sub = getRedisSub();

  // subscribe to cross-instance yjs updates via redis pub/sub.
  // the instanceId check prevents us from applying our own updates twice.
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

// returns full Yjs state as a plain array (JSON-serializable).
// this gets sent to new clients so they can hydrate their local doc.
export const getDocument = () => {
  return {
    content: Array.from(Y.encodeStateAsUpdate(ydoc)),
  };
};

// apply a CRDT update from a client, broadcast it to other instances
// via redis, and schedule a persist. Yjs handles merge conflicts
// internally so we don't need to worry about that here.
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

  schedulePersist(updatedBy);

  logger.info({ updatedBy }, "Yjs update applied");
};

// direct persist, not debounced. not currently called anywhere but
// keeping it around in case we need a force-save on shutdown or something.
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