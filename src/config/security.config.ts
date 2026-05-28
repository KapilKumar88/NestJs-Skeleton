import { registerAs } from '@nestjs/config';

/**
 * Security-related config values.
 * All read from env — never hardcoded.
 */
export default registerAs('security', () => ({
  throttleTtl: Number.parseInt(process.env.THROTTLE_TTL ?? '60', 10) || 60,
  throttleLimit: Number.parseInt(process.env.THROTTLE_LIMIT ?? '100', 10) || 100,
  maxLoginAttempts: Number.parseInt(process.env.MAX_LOGIN_ATTEMPTS ?? '5', 10) || 5,
  lockoutMinutes: Number.parseInt(process.env.LOCKOUT_MINUTES ?? '15', 10) || 15,
}));
