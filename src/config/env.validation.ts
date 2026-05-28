import { z } from 'zod';

/**
 * Zod schema for all environment variables.
 * Wired into ConfigModule.forRoot({ validate }) so the app refuses to boot
 * if any required secret is missing, malformed, or too weak.
 *
 * Security rules:
 *  - Secrets loaded only from env; never hardcoded.
 *  - App fails closed on missing/weak secrets.
 *  - JWT_SECRET and JWT_REFRESH_SECRET must differ.
 */
const envSchema = z
  .object({
    // ── App ────────────────────────────────────────────────────────────
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3030),

    // ── Database ───────────────────────────────────────────────────────
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

    // ── JWT — min 32 chars to ensure sufficient entropy ────────────────
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_EXPIRES_IN: z.string().default('15m'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

    // ── Redis ──────────────────────────────────────────────────────────
    REDIS_HOST: z.string().min(1, 'REDIS_HOST is required'),
    REDIS_PORT: z.coerce.number().int().min(1).max(65535).default(6379),
    REDIS_PASSWORD: z.string().optional(),

    // ── Mail ───────────────────────────────────────────────────────────
    MAIL_HOST: z.string().min(1, 'MAIL_HOST is required'),
    MAIL_PORT: z.coerce.number().int().default(587),
    MAIL_USER: z.string().min(1, 'MAIL_USER is required'),
    MAIL_PASS: z.string().min(1, 'MAIL_PASS is required'),
    MAIL_FROM: z.email('MAIL_FROM must be a valid email'),

    // ── Security / CORS / rate-limiting ───────────────────────────────
    CORS_ORIGINS: z.string().default(''), // comma-separated list; empty = deny all
    BODY_LIMIT: z.string().default('1mb'),
    APP_URL: z.string().default('http://localhost:3030'),

    // ── Rate limiting ─────────────────────────────────────────────────
    THROTTLE_TTL: z.coerce.number().int().positive().default(60), // seconds
    THROTTLE_LIMIT: z.coerce.number().int().positive().default(100), // requests per TTL

    // ── Account lockout ───────────────────────────────────────────────
    MAX_LOGIN_ATTEMPTS: z.coerce.number().int().positive().default(5),
    LOCKOUT_MINUTES: z.coerce.number().int().positive().default(15),
  })
  .refine((data) => data.JWT_SECRET !== data.JWT_REFRESH_SECRET, {
    message: 'JWT_SECRET and JWT_REFRESH_SECRET must be different values',
    path: ['JWT_REFRESH_SECRET'],
  });

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Called by ConfigModule.forRoot({ validate }) at bootstrap.
 * Throws a descriptive error and prevents app startup on invalid config.
 */
export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const messages = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`\n[Config] Environment variable validation failed:\n${messages}\n`);
  }
  return result.data;
}
