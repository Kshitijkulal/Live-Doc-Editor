import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["error", "warn"], // query logs are way too noisy, just errors + warnings
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}