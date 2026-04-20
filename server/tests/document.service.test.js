import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../src/config/prisma.js";
import { updateDocument, getDocument } from "../src/services/document.service.js";

describe("Document Service", () => {
  beforeEach(async () => {
    await prisma.document.deleteMany();

    await prisma.document.create({
      data: {
        content: "initial",
        version: 1,
      },
    });
  });

  it("should return document", async () => {
    const doc = await getDocument();
    expect(doc.content).toBe("initial");
    expect(doc.version).toBe(1);
  });

  it("should perform successful update", async () => {
    const result = await updateDocument("new content", 1, "user1");

    expect(result.conflict).toBe(false);
    expect(result.noop).toBe(false);
    expect(result.data.version).toBe(2);
    expect(result.data.updatedBy).toBe("user1");
  });

  it("should detect conflict", async () => {
    await updateDocument("first update", 1, "user1");

    const result = await updateDocument("second update", 1, "user2");

    expect(result.conflict).toBe(true);
    expect(result.data.server.version).toBe(2);
  });

  it("should detect no-op", async () => {
    const result = await updateDocument("initial", 1, "user1");

    expect(result.noop).toBe(true);
  });

  it("should reject large content", async () => {
    const large = "a".repeat(20000);

    await expect(
      updateDocument(large, 1, "user1")
    ).rejects.toThrow("Content too large");
  });

  it("should reject stale update after success", async () => {
    const doc = await getDocument();

    await updateDocument("A", doc.version, "user1");

    const result = await updateDocument("B", doc.version, "user2");

    expect(result.conflict).toBe(true);
  });
});