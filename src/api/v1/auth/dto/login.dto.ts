import { z } from 'zod';

export const loginSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(6),
});

export type LoginDto = z.infer<typeof loginSchema>;
