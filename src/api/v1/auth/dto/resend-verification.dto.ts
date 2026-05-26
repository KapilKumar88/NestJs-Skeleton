import { z } from 'zod';

export const resendVerificationSchema = z.object({
  email: z.email('Must be a valid email address'),
});

export type ResendVerificationDto = z.infer<typeof resendVerificationSchema>;
