import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const logoutSchema = z.object({
  refreshToken: z.string().optional(),
});

export class LogoutDto extends createZodDto(logoutSchema) {}
