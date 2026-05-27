/**
 * Auth-domain time constants.
 * All TTLs are expressed in milliseconds for direct use with `Date.now()`.
 */

/** Email-verification token lifetime: 24 hours. */
export const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/** Password-reset token lifetime: 1 hour. */
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
