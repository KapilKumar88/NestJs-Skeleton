/**
 * BullMQ email-queue job payload types.
 *
 * Security rule: fields containing raw tokens (verifyUrl, resetUrl)
 * must NEVER be logged — they carry single-use secrets in the URL.
 */

export interface WelcomeEmailJob {
  userId: number;
  email: string;
  name: string;
}

export interface VerifyEmailJob {
  email: string;
  name: string;
  verifyUrl: string; // contains raw token — NEVER log
}

export interface AccountExistsNoticeJob {
  email: string;
  name: string;
}

export interface PasswordResetJob {
  email: string;
  name: string;
  resetUrl: string; // contains raw token — NEVER log
}

export type AnyEmailJob =
  | WelcomeEmailJob
  | VerifyEmailJob
  | AccountExistsNoticeJob
  | PasswordResetJob;
