import { z } from 'zod';

export const logoutSchema = z.object({
  // Optional: provide the refresh token to revoke only the current session.
  // If omitted, all sessions for the user are revoked.
  refreshToken: z.string().optional(),
});

export type LogoutDto = z.infer<typeof logoutSchema>;
