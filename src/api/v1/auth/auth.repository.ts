import { Injectable } from '@nestjs/common';
import { Prisma, TokenType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../../services/database/prisma.service';

/**
 * All Prisma queries for the auth domain live here.
 * No business logic — only database access.
 */
@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ─── User lookups ─────────────────────────────────────────────────────────────

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: number) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async createUser(data: Prisma.UserCreateInput) {
    return this.prisma.user.create({
      data,
      select: { id: true, email: true, name: true, createdAt: true },
    });
  }

  async updateLastLogin(userId: number) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { last_login: new Date() },
    });
  }

  // ─── Family-based refresh tokens (S9) ────────────────────────────────────────

  /**
   * sha256 hash of a raw token.
   * High-entropy tokens (randomBytes(48) / JWT body) make sha256 safe for lookup
   * without bcrypt's cost.
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Stores a new refresh token for a brand-new login session (new family UUID).
   * The raw token is hashed before storage — it is never persisted in plaintext.
   */
  async issueRefreshToken(
    userId: number,
    rawToken: string,
    expiresAt: Date,
  ): Promise<void> {
    const family = crypto.randomUUID();
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(rawToken),
        family,
        expiresAt,
      },
    });
  }

  /**
   * Rotates a refresh token within its family.
   *
   * Outcomes:
   *  'ok'       — valid rotation; old record revoked, new record inserted (atomic).
   *  'reuse'    — old token was already revoked → entire family revoked (token theft).
   *  'not_found'— hash not in DB or record is expired.
   *
   * The 'reuse' case carries the family UUID so the service can include it in the
   * audit log.
   */
  async rotateRefreshToken(
    rawOldToken: string,
    rawNewToken: string,
    expiresAt: Date,
  ): Promise<
    | { status: 'ok' }
    | { status: 'reuse'; family: string }
    | { status: 'not_found' }
  > {
    const oldHash = this.hashToken(rawOldToken);

    // Find by hash; include slightly-expired records so reuse is detectable
    // within the JWT validity window (expired JWTs fail verification first).
    const existing = await this.prisma.refreshToken.findFirst({
      where: { tokenHash: oldHash },
    });

    if (!existing) return { status: 'not_found' };

    // Expired token — treat as not found (cannot be a valid session)
    if (existing.expiresAt < new Date()) return { status: 'not_found' };

    if (existing.revoked) {
      // Reuse detected — revoke entire family to contain the breach
      await this.prisma.refreshToken.updateMany({
        where: { family: existing.family },
        data: { revoked: true },
      });
      return { status: 'reuse', family: existing.family };
    }

    // Valid rotation: atomically revoke old + insert new in the same family
    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: existing.id },
        data: { revoked: true },
      }),
      this.prisma.refreshToken.create({
        data: {
          userId: existing.userId,
          tokenHash: this.hashToken(rawNewToken),
          family: existing.family,
          expiresAt,
        },
      }),
    ]);

    return { status: 'ok' };
  }

  /**
   * Revokes a specific refresh token by hash (logout — single session).
   * If the token is already revoked or not found, this is a no-op.
   */
  async revokeRefreshToken(rawToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hashToken(rawToken) },
      data: { revoked: true },
    });
  }

  /**
   * Revokes all refresh tokens for a user (logout-all / account disable).
   * Used as fallback when the raw refresh token is not available on logout.
   */
  async revokeAllUserSessions(userId: number): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId },
      data: { revoked: true },
    });
  }

  // ─── Email-verification tokens ───────────────────────────────────────────────

  /**
   * Generates a 192-bit random token, stores its sha256 hash, and returns the
   * raw token (the one and only time it is ever available in plaintext).
   *
   * Security:
   *  - High-entropy raw token (randomBytes(48)) makes sha256 safe for lookup
   *    without bcrypt overhead.
   *  - Any previous tokens of the same type are removed first (one active token
   *    per user per type — prevents token accumulation).
   *  - Raw token MUST NOT be persisted or logged anywhere after this call.
   */
  async createVerificationToken(
    userId: number,
    type: TokenType,
    expiresAt: Date,
  ): Promise<string> {
    const rawToken = crypto.randomBytes(48).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    // Remove any pre-existing tokens of the same type (cleanup + one-token-per-type)
    await this.prisma.verificationToken.deleteMany({ where: { userId, type } });

    await this.prisma.verificationToken.create({
      data: { userId, type, tokenHash, expiresAt },
    });

    return rawToken; // Return raw token ONCE — caller must email it, never store it
  }

  /**
   * Looks up the sha256 hash of `rawToken`, validates expiry, deletes the
   * record (single-use), and returns the associated userId.
   * Returns `null` if the token is not found or has expired.
   */
  async findAndConsumeVerificationToken(
    rawToken: string,
    type: TokenType,
  ): Promise<number | null> {
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const record = await this.prisma.verificationToken.findFirst({
      where: { tokenHash, type },
    });

    if (!record) return null;

    if (record.expiresAt < new Date()) {
      // Expired — remove to prevent accumulation
      await this.prisma.verificationToken.delete({ where: { id: record.id } });
      return null;
    }

    // Consume: delete before returning (single-use guarantee at DB level)
    await this.prisma.verificationToken.delete({ where: { id: record.id } });
    return record.userId;
  }

  /** Mark a user's email as verified. Called after a successful token consumption. */
  async markEmailVerified(userId: number): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true, emailVerifiedAt: new Date() },
    });
  }

  // ─── Account lockout ─────────────────────────────────────────────────────────

  /** Atomically increment the consecutive-failure counter. Returns the updated user. */
  async incrementFailedLoginAttempts(userId: number) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: { increment: 1 } },
    });
  }

  /** Set the lockout expiry timestamp after max failures are reached. */
  async lockAccount(userId: number, lockedUntil: Date) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { lockedUntil },
    });
  }

  /** Clear the failure counter and any lockout on successful login. */
  async resetFailedLoginAttempts(userId: number) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  }

  // ─── Password reset ───────────────────────────────────────────────────────────

  /**
   * Atomically updates the user's password and revokes ALL active refresh-token
   * families, forcing re-login on every device.
   *
   * revoke all sessions on password change.
   */
  async resetPasswordAndRevokeSessions(
    userId: number,
    passwordHash: string,
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { password: passwordHash },
      }),
      // Revoke all refresh-token families — force re-login everywhere
      this.prisma.refreshToken.updateMany({
        where: { userId },
        data: { revoked: true },
      }),
    ]);
  }

  // ─── bcrypt helpers (kept for password operations) ────────────────────────────

  /** bcrypt-compare a plaintext password against its stored hash. */
  async comparePassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
