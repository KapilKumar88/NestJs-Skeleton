import { z } from 'zod';

export const registerSchema = z.object({
  email: z.email().trim().toLowerCase(),
  name: z.string().min(2).max(100).trim(),
  password: z.string().min(6).max(128),
});

export type RegisterDto = z.infer<typeof registerSchema>;
