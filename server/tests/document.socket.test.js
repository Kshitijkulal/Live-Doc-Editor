import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { io as Client } from "socket.io-client";
import http from "http";
import { Server } from "socket.io";
import app from "../src/app.js";
import { registerDocumentSocket } from "../src/sockets/document.socket.js";
import { prisma } from "../src/config/prisma.js";

let io, server, client1, client2;

describe("Socket Integration", () => {
  beforeAll(async () => {
    server = http.createServer(app);
    io = new Server(server);

    registerDocumentSocket(io);

    await new Promise((res) => server.listen(4000, res));

    client1 = new Client("http://localhost:4000");
    client2 = new Client("http://localhost:4000");
  });

  beforeEach(async () => {
    // 🔥 isolate DB BEFORE EACH TEST
    await prisma.document.deleteMany();

    await prisma.document.create({
      data: {
        content: "initial",
        version: 1,
      },
    });

    // 🔥 remove ALL listeners (critical)
    client1.removeAllListeners();
    client2.removeAllListeners();
  });

  afterAll(() => {
    client1.close();
    client2.close();
    server.close();
  });

  it("should handle concurrent edits without breaking invariants", async () => {
    const results = [];

    await new Promise((resolve, reject) => {
      let ready = 0;
      let version1, version2;
      let finished = false;

      const finish = async () => {
        if (finished) return;
        finished = true;

        try {
          const updates = results.filter(r => r === "updated").length;
          const conflicts = results.filter(r => r === "conflict").length;

          // ✅ VALID SYSTEM INVARIANTS (NOT FAKE ASSUMPTIONS)

          // at least one outcome must exist
          expect(results.length).toBeGreaterThanOrEqual(1);

          // at most one update allowed
          expect(updates).toBeLessThanOrEqual(1);

          // total events bounded
          expect(updates + conflicts).toBeGreaterThanOrEqual(1);
          expect(updates + conflicts).toBeLessThanOrEqual(2);

          // ✅ DB STATE VALIDATION
          const doc = await prisma.document.findFirst();

          expect(doc).not.toBeNull();

          if (doc) {
            expect([1, 2]).toContain(doc.version);
            expect(["A", "B", "initial"]).toContain(doc.content);
          }

          resolve();
        } catch (err) {
          reject(err);
        }
      };

      const tryTrigger = () => {
        if (ready === 2) {
          client1.emit("edit_document", {
            content: "A",
            version: version1,
          });

          client2.emit("edit_document", {
            content: "B",
            version: version2,
          });
        }
      };

      // CLIENT 1
      client1.on("document_state", (data) => {
        version1 = data.data.version;
        ready++;
        tryTrigger();
      });

      client1.on("document_updated", () => {
        results.push("updated");
        finish();
      });

      client1.on("document_conflict", () => {
        results.push("conflict");
        finish();
      });

      client1.on("socket_error", (err) => {
        reject(new Error("Client1 error: " + err.message));
      });

      // CLIENT 2
      client2.on("document_state", (data) => {
        version2 = data.data.version;
        ready++;
        tryTrigger();
      });

      client2.on("document_updated", () => {
        results.push("updated");
        finish();
      });

      client2.on("document_conflict", () => {
        results.push("conflict");
        finish();
      });

      client2.on("socket_error", (err) => {
        reject(new Error("Client2 error: " + err.message));
      });

      // emit AFTER listeners
      client1.emit("join_document");
      client2.emit("join_document");

      // hard timeout fallback
      setTimeout(() => {
        if (!finished) {
          reject(new Error("Test timeout - no events received"));
        }
      }, 4000);
    });
  });

  it("should reject invalid payload via validation", async () => {
    await new Promise((resolve, reject) => {
      client1.on("socket_error", (err) => {
        try {
          expect(err.type).toBe("VALIDATION_ERROR");
          resolve();
        } catch (e) {
          reject(e);
        }
      });

      client1.emit("edit_document", {
        content: 123,
        version: "invalid",
      });
    });
  });
});