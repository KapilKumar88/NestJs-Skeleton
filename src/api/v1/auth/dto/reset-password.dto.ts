import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'token is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters'),
});

export class ResetPasswordDto extends createZodDto(resetPasswordSchema) {}
