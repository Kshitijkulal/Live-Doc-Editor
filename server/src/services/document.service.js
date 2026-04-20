import { prisma } from "../config/prisma.js";
import { logger } from "../utils/logger.js";
import { AppError } from "../utils/AppError.js";

export const getDocument = async () => {
  const doc = await prisma.document.findFirst();

  if (!doc) {
    logger.error("Document invariant violated: no base document found");
    throw new AppError("Document not initialized", 500);
  }

  return doc;
};

export const updateDocument = async (content, incomingVersion, updatedBy) => {
  // 🚫 basic guard (cheap check first)
  if (content.length > 10000) {
    throw new AppError("Content too large", 400);
  }

  const doc = await prisma.document.findFirst();

  if (!doc) {
    logger.error("Document invariant violated during update");
    throw new AppError("Document not found", 500);
  }

  // 🚫 NO-OP
  if (doc.content === content) {
    return {
      conflict: false,
      noop: true,
      data: doc,
    };
  }

  // ⚡ optimistic concurrency
  const result = await prisma.document.updateMany({
    where: {
      id: doc.id,
      version: incomingVersion,
    },
    data: {
      content,
      version: incomingVersion + 1,
      updatedBy,
    },
  });

  // ❌ CONFLICT
  if (result.count === 0) {
    logger.warn(
      {
        incomingVersion,
        currentVersion: doc.version,
      },
      "Version conflict detected"
    );

    return {
      conflict: true,
      data: {
        server: doc,
        attempted: content,
      },
    };
  }

  // ✅ SUCCESS (reconstruct state)
  const updatedDoc = {
    ...doc,
    content,
    version: incomingVersion + 1,
    updatedAt: new Date(),
    updatedBy,
  };

  logger.info(
    {
      version: updatedDoc.version,
      updatedBy,
    },
    "Document updated successfully"
  );

  return {
    conflict: false,
    noop: false,
    data: updatedDoc,
  };
};