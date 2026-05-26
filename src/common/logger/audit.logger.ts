import { Logger } from '@nestjs/common';

/**
 * Structured audit / security event logger.
 *
 * Every security-relevant event is logged to the "Security" context so it can
 * be filtered and forwarded independently of application logs.
 *
 * Rules:
 *  ✅ Log: userId, event type, requestId, path — no sensitive values.
 *  ❌ Never log: tokens, passwords, OTPs, reset links, raw email on failure paths.
 */
export class AuditLogger {
  private static readonly logger = new Logger('Security');

  /** User attempted registration (new or duplicate — same log either way). */
  static register(requestId?: string): void {
    // Email intentionally omitted — enumeration risk on failure paths
    this.logger.log(`[REGISTER_ATTEMPT] rid=${requestId ?? '-'}`);
  }

  /** Login succeeded. */
  static loginSuccess(userId: number, requestId?: string): void {
    this.logger.log(`[LOGIN_OK] userId=${userId} rid=${requestId ?? '-'}`);
  }

  /**
   * Login failed.
   * @param reason — machine-readable reason code (not echoed to clients)
   */
  static loginFailure(reason: string, requestId?: string): void {
    // Email omitted — never log on failure (enumeration risk)
    this.logger.warn(`[LOGIN_FAIL] reason=${reason} rid=${requestId ?? '-'}`);
  }

  /** User explicitly logged out. */
  static logout(userId: number, requestId?: string): void {
    this.logger.log(`[LOGOUT] userId=${userId} rid=${requestId ?? '-'}`);
  }

  /** Access token refreshed successfully. */
  static tokenRefresh(userId: number, requestId?: string): void {
    this.logger.log(`[TOKEN_REFRESH] userId=${userId} rid=${requestId ?? '-'}`);
  }

  /**
   * A previously rotated (revoked) refresh token was replayed — likely theft.
   * The entire token family is revoked on this event.
   */
  static refreshReuseDetected(
    userId: number,
    family: string,
    requestId?: string,
  ): void {
    this.logger.warn(
      `[REFRESH_REUSE] userId=${userId} family=${family} rid=${
        requestId ?? '-'
      }`,
    );
  }

  /** Email verification token consumed successfully. */
  static emailVerified(userId: number, requestId?: string): void {
    this.logger.log(
      `[EMAIL_VERIFIED] userId=${userId} rid=${requestId ?? '-'}`,
    );
  }

  /** Password-reset link was requested (always logged, email omitted). */
  static passwordResetRequested(requestId?: string): void {
    // Email omitted — always logs the same thing regardless of existence
    this.logger.log(`[PASSWORD_RESET_REQUESTED] rid=${requestId ?? '-'}`);
  }

  /** Password was successfully reset. */
  static passwordResetCompleted(userId: number, requestId?: string): void {
    this.logger.log(
      `[PASSWORD_RESET_DONE] userId=${userId} rid=${requestId ?? '-'}`,
    );
  }

  /** Account locked after too many failed login attempts. */
  static accountLocked(userId: number, requestId?: string): void {
    this.logger.warn(
      `[ACCOUNT_LOCKED] userId=${userId} rid=${requestId ?? '-'}`,
    );
  }

  /** Account unlocked after lockout period expired. */
  static accountUnlocked(userId: number, requestId?: string): void {
    this.logger.log(
      `[ACCOUNT_UNLOCKED] userId=${userId} rid=${requestId ?? '-'}`,
    );
  }

  /** JWT guard rejected an unauthenticated/unauthorised request. */
  static accessDenied(path: string, requestId?: string): void {
    this.logger.warn(`[ACCESS_DENIED] path=${path} rid=${requestId ?? '-'}`);
  }
}
