import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const resendVerificationSchema = z.object({
  email: z.email('Must be a valid email address'),
});

export class ResendVerificationDto extends createZodDto(resendVerificationSchema) {}
