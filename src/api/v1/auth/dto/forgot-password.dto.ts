import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const forgotPasswordSchema = z.object({
  email: z.email('Must be a valid email address').trim().toLowerCase(),
});

export class ForgotPasswordDto extends createZodDto(forgotPasswordSchema) {}
