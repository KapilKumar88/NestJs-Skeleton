import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as bcrypt from 'bcryptjs';
import { TokenType } from '@prisma/client';
import { AuthRepository } from './auth.repository';
import { type RegisterDto } from './dto/register.dto';
import { type LoginDto } from './dto/login.dto';
import { type RefreshTokenDto } from './dto/refresh-token.dto';
import { type VerifyEmailDto } from './dto/verify-email.dto';
import { type ResendVerificationDto } from './dto/resend-verification.dto';
import { type ForgotPasswordDto } from './dto/forgot-password.dto';
import { type ResetPasswordDto } from './dto/reset-password.dto';
import { EMAIL_QUEUE, EmailJobName } from '../../../common/constants';
import { VERIFY_TOKEN_TTL_MS, RESET_TOKEN_TTL_MS } from '../../../common/constants/auth.constants';
import { AuditLogger } from '../../../common/logger/audit.logger';
import { type LoginResponse, type TokenPair } from '../../../types/auth.types';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectQueue(EMAIL_QUEUE) private readonly emailQueue: Queue,
  ) {}

  // ─── Register ────────────────────────────────────────────────────────────────

  /**
   * Enumeration-safe registration.
   *
   * Whether the email is new or already registered, the caller always gets the
   * same 200 response. A verification email is sent for new accounts; an
   * "account already exists" notice is sent for duplicates — both via queue.
   *
   * No tokens are issued at registration. The user must verify their email first.
   */
  async register(dto: RegisterDto, requestId?: string): Promise<null> {
    AuditLogger.register(requestId);

    const existing = await this.authRepository.findByEmail(dto.email);

    if (existing) {
      // Duplicate: send a notice to the account owner, reveal nothing to caller
      // void = intentional fire-and-forget; error is caught and logged
      void this.emailQueue
        .add(EmailJobName.ACCOUNT_EXISTS_NOTICE, {
          email: existing.email,
          name: existing.name,
        })
        .catch((err: Error) =>
          this.logger.warn(`Failed to enqueue account-exists notice: ${err.message}`),
        );
    } else {
      const salt = await bcrypt.genSalt();
      const passwordHash = await bcrypt.hash(dto.password, salt);

      const user = await this.authRepository.createUser({
        email: dto.email,
        name: dto.name,
        password: passwordHash,
      });

      const expiresAt = new Date(Date.now() + VERIFY_TOKEN_TTL_MS);
      const rawToken = await this.authRepository.createVerificationToken(
        user.id,
        TokenType.EMAIL_VERIFY,
        expiresAt,
      );

      const appUrl = this.configService.get<string>('app.appUrl');
      // verifyUrl contains the raw token — sent in the email, never logged
      const verifyUrl = `${appUrl}/v1/auth/verify-email?token=${rawToken}`;

      void this.emailQueue
        .add(EmailJobName.VERIFY_EMAIL, {
          email: user.email,
          name: user.name,
          verifyUrl,
        })
        .catch((err: Error) =>
          this.logger.warn(`Failed to enqueue verification email: ${err.message}`),
        );
    }

    // Uniform response — callers cannot distinguish new vs duplicate email
    return null;
  }

  // ─── Login ───────────────────────────────────────────────────────────────────

  /**
   * Credential-first login with lockout and email-verification gates.
   *
   * Ordering is security-critical — each step uses generic "Invalid credentials"
   * so callers cannot distinguish user-not-found / locked / wrong-password states:
   *
   *  1. User lookup     → 401 "Invalid credentials" if not found
   *  2. Lockout check   → 401 "Invalid credentials" if currently locked
   *     (checked before bcrypt to prevent timing-oracle between locked vs wrong-pw)
   *  3. Password check  → increment failure counter; lock if threshold reached
   *  4. Email-verified  → 401 with explicit message ONLY after correct password
   *     (prevents enumeration: attacker cannot learn "unverified" without knowing pw)
   *  5. Success         → reset counter, issue tokens, audit
   */
  async login(dto: LoginDto, requestId?: string): Promise<LoginResponse> {
    const user = await this.authRepository.findByEmail(dto.email);
    if (!user) {
      AuditLogger.loginFailure('user_not_found', requestId);
      throw new UnauthorizedException('Invalid credentials');
    }

    // ── Lockout gate ─────────────────────────────────────────────────────────
    // Checked BEFORE password to avoid a timing oracle (locked ≠ wrong-pw timing).
    // Response is always generic — locked accounts are indistinguishable from
    // non-existent ones to an unauthenticated caller.
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      AuditLogger.loginFailure('account_locked', requestId);
      throw new UnauthorizedException('Invalid credentials');
    }

    // ── Password check ────────────────────────────────────────────────────────
    const passwordMatch = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatch) {
      const maxAttempts = this.configService.get<number>('security.maxLoginAttempts') ?? 5;
      const lockoutMinutes = this.configService.get<number>('security.lockoutMinutes') ?? 15;

      const updated = await this.authRepository.incrementFailedLoginAttempts(user.id);

      if (updated.failedLoginAttempts >= maxAttempts) {
        const lockedUntil = new Date(Date.now() + lockoutMinutes * 60 * 1000);
        await this.authRepository.lockAccount(user.id, lockedUntil);
        AuditLogger.accountLocked(user.id, requestId);
      }

      AuditLogger.loginFailure('wrong_password', requestId);
      throw new UnauthorizedException('Invalid credentials');
    }

    // ── Email-verification gate ───────────────────────────────────────────────
    // Revealed ONLY after a correct password — prevents enumeration.
    if (!user.emailVerified) {
      AuditLogger.loginFailure('email_not_verified', requestId);
      throw new UnauthorizedException('Please verify your email address before logging in');
    }

    // ── Success ───────────────────────────────────────────────────────────────
    const tokens = await this.generateTokens(user.id, user.email);
    const refreshExpiresAt = this.parseRefreshExpiresAt();

    // All three writes are independent — run in parallel
    await Promise.all([
      this.authRepository.issueRefreshToken(user.id, tokens.refreshToken, refreshExpiresAt),
      this.authRepository.resetFailedLoginAttempts(user.id),
      this.authRepository.updateLastLogin(user.id),
    ]);

    AuditLogger.loginSuccess(user.id, requestId);
    return {
      user: { id: user.id, email: user.email, name: user.name },
      ...tokens,
    };
  }

  // ─── Verify Email ─────────────────────────────────────────────────────────────

  /**
   * Consumes a single-use email-verification token and marks the user verified.
   * Returns a generic 401 for any invalid/expired token — no per-case disclosure.
   */
  async verifyEmail(dto: VerifyEmailDto, requestId?: string): Promise<null> {
    const userId = await this.authRepository.findAndConsumeVerificationToken(
      dto.token,
      TokenType.EMAIL_VERIFY,
    );

    if (userId === null) {
      throw new UnauthorizedException('Invalid or expired verification token');
    }

    await this.authRepository.markEmailVerified(userId);
    AuditLogger.emailVerified(userId, requestId);
    return null;
  }

  // ─── Resend Verification ──────────────────────────────────────────────────────

  /**
   * Resends a verification email.
   * Enumeration-safe: always returns the same response regardless of whether
   * the email exists, is already verified, or is unverified.
   */
  async resendVerification(dto: ResendVerificationDto, _requestId?: string): Promise<null> {
    // _requestId is intentionally unused here — it is logged at the controller level

    const user = await this.authRepository.findByEmail(dto.email);

    if (user && !user.emailVerified) {
      const expiresAt = new Date(Date.now() + VERIFY_TOKEN_TTL_MS);
      const rawToken = await this.authRepository.createVerificationToken(
        user.id,
        TokenType.EMAIL_VERIFY,
        expiresAt,
      );

      const appUrl = this.configService.get<string>('app.appUrl');
      const verifyUrl = `${appUrl}/v1/auth/verify-email?token=${rawToken}`;

      void this.emailQueue
        .add(EmailJobName.VERIFY_EMAIL, {
          email: user.email,
          name: user.name,
          verifyUrl,
        })
        .catch((err: Error) =>
          this.logger.warn(`Failed to enqueue resend verification email: ${err.message}`),
        );
    }
    // No else branch — same null is returned whether or not we acted

    return null;
  }

  // ─── Forgot Password ──────────────────────────────────────────────────────────

  /**
   * Enumeration-safe forgot-password.
   *
   * The caller always gets the same 200 response.
   * If the email matches an account, a single-use 1-hour PASSWORD_RESET token
   * is generated and the reset link is emailed via queue.
   * If not, silently returns — no existence disclosure.
   *
   * The raw token is placed only in the email body — never logged.
   */
  async forgotPassword(dto: ForgotPasswordDto, requestId?: string): Promise<null> {
    AuditLogger.passwordResetRequested(requestId);

    const user = await this.authRepository.findByEmail(dto.email);

    if (user) {
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
      const rawToken = await this.authRepository.createVerificationToken(
        user.id,
        TokenType.PASSWORD_RESET,
        expiresAt,
      );

      const appUrl = this.configService.get<string>('app.appUrl');
      // resetUrl contains the raw token — sent in the email, never logged
      const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;

      void this.emailQueue
        .add(EmailJobName.PASSWORD_RESET, {
          email: user.email,
          name: user.name,
          resetUrl,
        })
        .catch((err: Error) =>
          this.logger.warn(`Failed to enqueue password-reset email: ${err.message}`),
        );
    }

    // Uniform response — same null returned whether or not user exists (enumeration safety)
    return null;
  }

  // ─── Reset Password ───────────────────────────────────────────────────────────

  /**
   * Validates the single-use reset token, sets a new bcrypt password hash,
   * and revokes all active sessions (force re-login on all devices).
   *
   * Returns a generic 401 for any invalid/expired token — no per-case disclosure.
   */
  async resetPassword(dto: ResetPasswordDto, requestId?: string): Promise<null> {
    const userId = await this.authRepository.findAndConsumeVerificationToken(
      dto.token,
      TokenType.PASSWORD_RESET,
    );

    if (userId === null) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(dto.password, await bcrypt.genSalt());

    // Atomically update password + revoke all sessions
    await this.authRepository.resetPasswordAndRevokeSessions(userId, passwordHash);

    AuditLogger.passwordResetCompleted(userId, requestId);
    return null;
  }

  // ─── Refresh ─────────────────────────────────────────────────────────────────

  /**
   * Family-based token rotation with reuse detection.
   *
   * Flow:
   *  1. Verify refresh JWT signature + expiry.
   *  2. Generate a new token pair (email embedded in refresh JWT for round-trip).
   *  3. Call rotateRefreshToken:
   *     - 'ok'        → return new tokens.
   *     - 'reuse'     → whole family revoked; likely token theft — audit + 401.
   *     - 'not_found' → token not in DB or expired → 401.
   */
  async refreshTokens(dto: RefreshTokenDto, requestId?: string): Promise<TokenPair> {
    let payload: { sub: number; email: string };

    try {
      payload = this.jwtService.verify(dto.refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const refreshExpiresAt = this.parseRefreshExpiresAt();
    const { accessToken, refreshToken: newRawToken } = await this.generateTokens(
      payload.sub,
      payload.email,
    );

    const result = await this.authRepository.rotateRefreshToken(
      dto.refreshToken,
      newRawToken,
      refreshExpiresAt,
    );

    if (result.status === 'reuse') {
      // Likely token theft — entire family is already revoked by the repository
      AuditLogger.refreshReuseDetected(payload.sub, result.family, requestId);
      throw new UnauthorizedException('Session invalidated — please log in again');
    }

    if (result.status === 'not_found') {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    AuditLogger.tokenRefresh(payload.sub, requestId);
    return { accessToken, refreshToken: newRawToken };
  }

  // ─── Logout ──────────────────────────────────────────────────────────────────

  /**
   * Revokes the presented refresh token (specific session).
   * If no token is provided, revokes all sessions for the user (fallback).
   */
  async logout(userId: number, rawRefreshToken?: string, requestId?: string): Promise<void> {
    if (rawRefreshToken) {
      await this.authRepository.revokeRefreshToken(rawRefreshToken);
    } else {
      // Fallback: no token provided — revoke all sessions
      await this.authRepository.revokeAllUserSessions(userId);
    }
    AuditLogger.logout(userId, requestId);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  /**
   * Signs a new access + refresh token pair.
   *
   * Both tokens carry `{ sub, email }`. Including `email` in the refresh payload
   * allows `refreshTokens` to regenerate an access token without a DB user lookup.
   */
  private async generateTokens(userId: number, email: string): Promise<TokenPair> {
    const payload = { sub: userId, email };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        // JWT_REFRESH_EXPIRES_IN is validated by Zod at startup — safe to assert StringValue
        expiresIn: this.configService.get<string>('jwt.refreshExpiresIn') as JwtSignOptions['expiresIn'],
      }),
    ]);

    return { accessToken, refreshToken };
  }

  /**
   * Parses `JWT_REFRESH_EXPIRES_IN` (e.g. "7d", "24h", "3600s") into an
   * absolute Date for storing in the RefreshToken table.
   * Falls back to 7 days if the format is unrecognised.
   */
  private parseRefreshExpiresAt(): Date {
    const expiresIn = this.configService.get<string>('jwt.refreshExpiresIn') ?? '7d';
    const match = /^(\d+)([dhms])?$/.exec(expiresIn);
    if (!match) return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const value = Number.parseInt(match[1], 10);
    const unit = match[2] ?? 's';
    const ms: Record<string, number> = {
      d: 86_400_000,
      h: 3_600_000,
      m: 60_000,
      s: 1_000,
    };
    return new Date(Date.now() + value * (ms[unit] ?? 1_000));
  }
}
