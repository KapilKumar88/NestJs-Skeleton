import { type User } from '@prisma/client';

/**
 * Builds a mock User object with safe, realistic defaults.
 * Omits relation fields (todos, verificationTokens, refreshTokens) — they are
 * not present on plain Prisma User queries.
 *
 * S9 note: hashedRefreshToken column was removed — it is NOT present here.
 */
export const buildUser = (overrides?: Partial<User>): User => ({
  id: 1,
  email: 'test@example.com',
  name: 'Test User',
  password: '$2b$10$hashedpassword.placeholder', // NOSONAR — fake bcrypt hash used only in tests
  emailVerified: true,
  emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
  failedLoginAttempts: 0,
  lockedUntil: null,
  last_login: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  deletedAt: null,
  ...overrides,
});
