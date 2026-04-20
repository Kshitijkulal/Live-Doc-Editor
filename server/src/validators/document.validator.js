import { z } from "zod";

export const editDocumentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Content cannot be empty")
    .max(10000, "Content too long"),

  version: z
    .number()
    .int()
    .nonnegative("Version must be >= 0"),
});