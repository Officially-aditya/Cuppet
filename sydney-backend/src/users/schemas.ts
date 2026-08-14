import { z } from "zod";

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    image: z.string().trim().min(1).max(500).optional(),
    avatar: z.number().int().min(1).max(9).optional()
  })
  .strict();
