import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'token is required'),
});

export class VerifyEmailDto extends createZodDto(verifyEmailSchema) {}
