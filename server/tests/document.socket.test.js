import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { io as Client } from "socket.io-client";
import http from "http";
import { Server } from "socket.io";
import app from "../src/app.js";
import { registerDocumentSocket } from "../src/sockets/document.socket.js";
import { prisma } from "../src/config/prisma.js";
import { initYDoc } from "../src/services/document.service.js";
import { initRedis } from "../src/config/redis.js";
import * as Y from "yjs";

let io, server, client1, client2;

const createUpdate = (value) => {
  const doc = new Y.Doc();
  const text = doc.getText("content");
  text.insert(0, value);
  return Array.from(Y.encodeStateAsUpdate(doc));
};

beforeAll(async () => {
  await initRedis();

  server = http.createServer(app);
  io = new Server(server);

  registerDocumentSocket(io);

  await new Promise((res) => server.listen(4000, res));

  client1 = new Client("http://localhost:4000");
  client2 = new Client("http://localhost:4000");
});

beforeEach(async () => {
  await prisma.document.deleteMany();

  await prisma.document.create({
    data: { content: "" },
  });

  await initYDoc();

  client1.removeAllListeners();
  client2.removeAllListeners();
});

afterAll(() => {
  client1.close();
  client2.close();
  server.close();
});

describe("Socket Integration (Yjs)", () => {
  it("should sync updates between clients", async () => {
    await new Promise((resolve, reject) => {
      let received = false;

      client2.on("yjs_update", (data) => {
        received = true;
        expect(data.update).toBeDefined();
        resolve();
      });

      client1.emit("join_document", { id: "user1", name: "User 1" });
      client2.emit("join_document", { id: "user2", name: "User 2" });

      setTimeout(() => {
        client1.emit("yjs_update", createUpdate("hello"));
      }, 500);

      setTimeout(() => {
        if (!received) reject(new Error("No update received"));
      }, 3000);
    });
  });

  it("should send document state", async () => {
    await new Promise((resolve) => {
      client1.on("document_state", (data) => {
        expect(data.data).toBeDefined();
        resolve();
      });

      client1.emit("join_document", { id: "user1", name: "User 1" });
    });
  });

  it("should track presence", async () => {
    await new Promise((resolve) => {
      client1.on("presence_update", (users) => {
        expect(users.length).toBeGreaterThanOrEqual(1);
        resolve();
      });

      client1.emit("join_document", { id: "user1", name: "User 1" });
    });
  });

  it("should emit typing", async () => {
    await new Promise((resolve) => {
      client2.on("user_typing", () => resolve());

      client1.emit("join_document", { id: "user1", name: "User 1" });
      client2.emit("join_document", { id: "user2", name: "User 2" });

      setTimeout(() => {
        client1.emit("typing");
      }, 500);
    });
  });
});