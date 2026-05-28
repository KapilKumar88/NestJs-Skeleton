import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const registerSchema = z.object({
  email: z.email().trim().toLowerCase(),
  name: z.string().min(2).max(100).trim(),
  password: z.string().min(6).max(128),
});

export class RegisterDto extends createZodDto(registerSchema) {}
