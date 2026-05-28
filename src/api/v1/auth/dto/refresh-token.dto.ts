import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken is required'),
});

export class RefreshTokenDto extends createZodDto(refreshTokenSchema) {}
