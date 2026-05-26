import { z } from 'zod';

export const forgotPasswordSchema = z.object({
  email: z.email('Must be a valid email address').trim().toLowerCase(),
});

export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;
