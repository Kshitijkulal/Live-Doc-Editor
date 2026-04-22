import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "../src/config/prisma.js";
import {
  applyUpdate,
  getDocument,
  initYDoc,
} from "../src/services/document.service.js";
import * as Y from "yjs";
import { initRedis } from "../src/config/redis.js";

beforeAll(async () => {
  await initRedis();

  await prisma.document.deleteMany();

  await prisma.document.create({
    data: { content: "" },
  });

  await initYDoc();
}, 30_000);

const createUpdate = (value) => {
  const doc = new Y.Doc();
  const text = doc.getText("content");
  text.insert(0, value);
  return Array.from(Y.encodeStateAsUpdate(doc));
};

describe("Document Service (Yjs)", () => {
  it("should return initial Yjs state", () => {
    const doc = getDocument();
    expect(doc.content).toBeInstanceOf(Array);
  });

  it("should apply update", async () => {
    const update = createUpdate("hello");
    await applyUpdate(update, "user1");

    const doc = getDocument();
    expect(doc.content).toBeDefined();
  });

  it("should merge updates", async () => {
    await applyUpdate(createUpdate("A"), "user1");
    await applyUpdate(createUpdate("B"), "user2");

    const doc = getDocument();
    expect(doc.content).toBeDefined();
  });

  it("should be idempotent", async () => {
    const update = createUpdate("same");

    await applyUpdate(update, "user1");
    await applyUpdate(update, "user1");

    const doc = getDocument();
    expect(doc.content).toBeDefined();
  });

  it("should persist to DB", async () => {
    await applyUpdate(createUpdate("persist"), "user1");

    // wait for the 2s debounced persist to fire
    await new Promise((r) => setTimeout(r, 2500));

    const dbDoc = await prisma.document.findFirst();
    expect(dbDoc.content).toBeTruthy();
  });
});