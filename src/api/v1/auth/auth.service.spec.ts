/**
 * Security-focused unit tests for AuthService.
 *
 * Tests verify the behaviours:
 *  - Enumeration resistance (register, forgot-password)
 *  - Credential-first ordering in login (lockout before bcrypt, email-gate after)
 *  - Account lockout threshold and counter management
 *  - Single-use token consumption (verify-email, reset-password)
 *  - Family-based reuse detection in refresh flow
 *  - No tokens issued at registration
 */

import { Test, type TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import * as bcrypt from 'bcryptjs';

import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { EMAIL_QUEUE } from '../../../queues/email/email.processor';
import { buildUser } from '../../../test/factories/user.factory';

// ─── bcrypt mock ──────────────────────────────────────────────────────────────
// Hoisted by Jest; replaces bcryptjs for all imports in this test run.
jest.mock('bcryptjs', () => ({
  genSalt: jest.fn().mockResolvedValue('mock-salt'),
  hash: jest.fn().mockResolvedValue('$2b$10$mocked-hash'),
  compare: jest.fn().mockResolvedValue(false), // default: wrong password
}));

const mockBcryptCompare = bcrypt.compare as jest.Mock;
const mockBcryptHash = bcrypt.hash as jest.Mock;

// ─── Repository mock ──────────────────────────────────────────────────────────

const mockRepo = () => ({
  findByEmail: jest.fn(),
  findById: jest.fn(),
  createUser: jest.fn(),
  updateLastLogin: jest.fn().mockResolvedValue(undefined),
  issueRefreshToken: jest.fn().mockResolvedValue(undefined),
  rotateRefreshToken: jest.fn(),
  revokeRefreshToken: jest.fn().mockResolvedValue(undefined),
  revokeAllUserSessions: jest.fn().mockResolvedValue(undefined),
  createVerificationToken: jest.fn().mockResolvedValue('raw-token-96hex'),
  findAndConsumeVerificationToken: jest.fn(),
  markEmailVerified: jest.fn().mockResolvedValue(undefined),
  incrementFailedLoginAttempts: jest.fn(),
  lockAccount: jest.fn().mockResolvedValue(undefined),
  resetFailedLoginAttempts: jest.fn().mockResolvedValue(undefined),
  resetPasswordAndRevokeSessions: jest.fn().mockResolvedValue(undefined),
});

// ─── Queue mock ───────────────────────────────────────────────────────────────

const mockQueue = {
  add: jest.fn().mockResolvedValue({ id: 'job-1' }),
};

// ─── Test setup ───────────────────────────────────────────────────────────────

describe('AuthService (security)', () => {
  let service: AuthService;
  let repo: ReturnType<typeof mockRepo>;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(async () => {
    repo = mockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: repo },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('mock-jwt-token'),
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              const cfg: Record<string, unknown> = {
                'app.appUrl': 'http://localhost:3030',
                'security.maxLoginAttempts': 5,
                'security.lockoutMinutes': 15,
                'jwt.refreshSecret': 'test-refresh-secret-32chars-min!!',
                'jwt.refreshExpiresIn': '7d',
              };
              return cfg[key];
            }),
          },
        },
        { provide: getQueueToken(EMAIL_QUEUE), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService) as jest.Mocked<JwtService>;

    // Suppress logger output in tests
    jest.spyOn(service['logger'], 'log').mockImplementation(() => undefined);
    jest.spyOn(service['logger'], 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => jest.clearAllMocks());

  // ═══════════════════════════════════════════════════════════════════════════
  // register
  // ═══════════════════════════════════════════════════════════════════════════

  describe('register', () => {
    const dto = {
      email: 'new@example.com',
      name: 'New User',
      password: 'StrongPass1!',
    };

    it('returns null (no tokens) for a new email — enumeration-safe uniform response', async () => {
      repo.findByEmail.mockResolvedValue(null);
      repo.createUser.mockResolvedValue({
        id: 2,
        email: dto.email,
        name: dto.name,
        createdAt: new Date(),
      });

      const result = await service.register(dto as any);

      expect(result).toBeNull();
    });

    it('returns the SAME null for a duplicate email — no 409, enumeration blocked', async () => {
      const existing = buildUser({ email: dto.email });
      repo.findByEmail.mockResolvedValue(existing);

      const result = await service.register(dto as any);

      expect(result).toBeNull();
    });

    it('enqueues verify-email job for a new user', async () => {
      repo.findByEmail.mockResolvedValue(null);
      repo.createUser.mockResolvedValue({
        id: 2,
        email: dto.email,
        name: dto.name,
        createdAt: new Date(),
      });

      await service.register(dto as any);

      expect(mockQueue.add).toHaveBeenCalledWith(
        'verify-email',
        expect.objectContaining({
          email: dto.email,
          verifyUrl: expect.any(String),
        }),
      );
      // verifyUrl must contain the raw token (to be emailed)
      const jobPayload = mockQueue.add.mock.calls[0][1] as {
        verifyUrl: string;
      };
      expect(jobPayload.verifyUrl).toContain('raw-token-96hex');
    });

    it('enqueues account-exists-notice for a duplicate email — does NOT create a user', async () => {
      const existing = buildUser({ email: dto.email, name: 'Existing User' });
      repo.findByEmail.mockResolvedValue(existing);

      await service.register(dto as any);

      expect(repo.createUser).not.toHaveBeenCalled();
      expect(mockQueue.add).toHaveBeenCalledWith(
        'account-exists-notice',
        expect.objectContaining({ email: existing.email }),
      );
    });

    it('does NOT issue access or refresh tokens at registration', async () => {
      repo.findByEmail.mockResolvedValue(null);
      repo.createUser.mockResolvedValue({
        id: 2,
        email: dto.email,
        name: dto.name,
        createdAt: new Date(),
      });

      const result = await service.register(dto as any);

      // No tokens in the return value
      expect(result).toBeNull();
      // JwtService.signAsync must not have been called
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // login
  // ═══════════════════════════════════════════════════════════════════════════

  describe('login', () => {
    const dto = { email: 'user@example.com', password: 'CorrectPass1!' };
    const verifiedUser = buildUser({
      email: dto.email,
      emailVerified: true,
      failedLoginAttempts: 0,
    });

    it('returns 401 "Invalid credentials" for an unknown email — no existence disclosure', async () => {
      repo.findByEmail.mockResolvedValue(null);

      await expect(service.login(dto as any)).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );
    });

    it('returns 401 "Invalid credentials" for a locked account — no "locked" disclosure', async () => {
      const locked = buildUser({
        email: dto.email,
        lockedUntil: new Date(Date.now() + 10 * 60 * 1000), // locked for 10 more minutes
      });
      repo.findByEmail.mockResolvedValue(locked);

      await expect(service.login(dto as any)).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );
      // bcrypt must NOT be called — timing oracle prevention
      expect(mockBcryptCompare).not.toHaveBeenCalled();
    });

    it('returns 401 "Invalid credentials" for a wrong password (same message as unknown email)', async () => {
      repo.findByEmail.mockResolvedValue(verifiedUser);
      mockBcryptCompare.mockResolvedValueOnce(false);
      repo.incrementFailedLoginAttempts.mockResolvedValue({
        ...verifiedUser,
        failedLoginAttempts: 1,
      });

      await expect(service.login(dto as any)).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );
    });

    it('increments failedLoginAttempts on a wrong-password attempt', async () => {
      repo.findByEmail.mockResolvedValue(verifiedUser);
      mockBcryptCompare.mockResolvedValueOnce(false);
      repo.incrementFailedLoginAttempts.mockResolvedValue({
        ...verifiedUser,
        failedLoginAttempts: 1,
      });

      await expect(service.login(dto as any)).rejects.toThrow(UnauthorizedException);

      expect(repo.incrementFailedLoginAttempts).toHaveBeenCalledWith(verifiedUser.id);
    });

    it('locks the account after MAX_LOGIN_ATTEMPTS (5) consecutive wrong-password failures', async () => {
      repo.findByEmail.mockResolvedValue(verifiedUser);
      mockBcryptCompare.mockResolvedValueOnce(false);
      // incrementFailedLoginAttempts returns the threshold count
      repo.incrementFailedLoginAttempts.mockResolvedValue({
        ...verifiedUser,
        failedLoginAttempts: 5, // == maxLoginAttempts
      });

      await expect(service.login(dto as any)).rejects.toThrow(UnauthorizedException);

      expect(repo.lockAccount).toHaveBeenCalledWith(verifiedUser.id, expect.any(Date));
    });

    it('does NOT lock the account when failures are below the threshold', async () => {
      repo.findByEmail.mockResolvedValue(verifiedUser);
      mockBcryptCompare.mockResolvedValueOnce(false);
      repo.incrementFailedLoginAttempts.mockResolvedValue({
        ...verifiedUser,
        failedLoginAttempts: 3, // < maxLoginAttempts
      });

      await expect(service.login(dto as any)).rejects.toThrow(UnauthorizedException);

      expect(repo.lockAccount).not.toHaveBeenCalled();
    });

    it('returns 401 with email-verification message ONLY after correct password — prevents enumeration', async () => {
      const unverified = buildUser({ email: dto.email, emailVerified: false });
      repo.findByEmail.mockResolvedValue(unverified);
      mockBcryptCompare.mockResolvedValueOnce(true); // correct password

      await expect(service.login(dto as any)).rejects.toThrow(
        new UnauthorizedException('Please verify your email address before logging in'),
      );
    });

    it('issues tokens and resets the failure counter on a successful verified login', async () => {
      repo.findByEmail.mockResolvedValue(verifiedUser);
      mockBcryptCompare.mockResolvedValueOnce(true);

      const result = await service.login(dto as any);

      expect(result).toMatchObject({
        user: { id: verifiedUser.id, email: verifiedUser.email },
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
      });
      expect(repo.resetFailedLoginAttempts).toHaveBeenCalledWith(verifiedUser.id);
      expect(repo.issueRefreshToken).toHaveBeenCalledWith(
        verifiedUser.id,
        expect.any(String),
        expect.any(Date),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // refreshTokens
  // ═══════════════════════════════════════════════════════════════════════════

  describe('refreshTokens', () => {
    const dto = { refreshToken: 'old-refresh-token' };
    const jwtPayload = { sub: 1, email: 'user@example.com' };

    it('returns a new token pair for a valid non-revoked token', async () => {
      (jwtService.verify as jest.Mock).mockReturnValue(jwtPayload);
      repo.rotateRefreshToken.mockResolvedValue({ status: 'ok' });

      const result = await service.refreshTokens(dto as any);

      expect(result).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
      });
    });

    it('returns 401 for an expired or invalid JWT (verify throws)', async () => {
      (jwtService.verify as jest.Mock).mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(service.refreshTokens(dto as any)).rejects.toThrow(
        new UnauthorizedException('Invalid or expired refresh token'),
      );
    });

    it('returns 401 when the token is not found in the DB (not_found)', async () => {
      (jwtService.verify as jest.Mock).mockReturnValue(jwtPayload);
      repo.rotateRefreshToken.mockResolvedValue({ status: 'not_found' });

      await expect(service.refreshTokens(dto as any)).rejects.toThrow(
        new UnauthorizedException('Invalid or expired refresh token'),
      );
    });

    it('returns 401 "Session invalidated" and revokes the whole family on reuse detection', async () => {
      (jwtService.verify as jest.Mock).mockReturnValue(jwtPayload);
      repo.rotateRefreshToken.mockResolvedValue({
        status: 'reuse',
        family: 'family-uuid-123',
      });

      await expect(service.refreshTokens(dto as any)).rejects.toThrow(
        new UnauthorizedException('Session invalidated — please log in again'),
      );
      // rotateRefreshToken already revoked the family (tested in repo unit); confirm it was called
      expect(repo.rotateRefreshToken).toHaveBeenCalled();
    });

    it('calls rotateRefreshToken with the old token, a new token, and a future expiry', async () => {
      (jwtService.verify as jest.Mock).mockReturnValue(jwtPayload);
      repo.rotateRefreshToken.mockResolvedValue({ status: 'ok' });
      const before = new Date();

      await service.refreshTokens(dto as any);
      const after = new Date();

      const [oldToken, , expiry] = repo.rotateRefreshToken.mock.calls[0] as [string, string, Date];
      expect(oldToken).toBe(dto.refreshToken);
      expect(expiry.getTime()).toBeGreaterThan(before.getTime());
      expect(expiry.getTime()).toBeGreaterThan(after.getTime()); // expiry is in the future
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // forgotPassword
  // ═══════════════════════════════════════════════════════════════════════════

  describe('forgotPassword', () => {
    const dto = { email: 'someone@example.com' };

    it('returns null for an unknown email — silent no-op (enumeration-safe)', async () => {
      repo.findByEmail.mockResolvedValue(null);

      const result = await service.forgotPassword(dto as any);

      expect(result).toBeNull();
      expect(repo.createVerificationToken).not.toHaveBeenCalled();
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('returns null for a known email — SAME return value (enumeration-safe)', async () => {
      repo.findByEmail.mockResolvedValue(buildUser({ email: dto.email }));

      const result = await service.forgotPassword(dto as any);

      expect(result).toBeNull();
    });

    it('generates a verification token and queues a password-reset email for a known account', async () => {
      const user = buildUser({ email: dto.email });
      repo.findByEmail.mockResolvedValue(user);

      await service.forgotPassword(dto as any);

      expect(repo.createVerificationToken).toHaveBeenCalledWith(
        user.id,
        'PASSWORD_RESET',
        expect.any(Date),
      );
      expect(mockQueue.add).toHaveBeenCalledWith(
        'password-reset',
        expect.objectContaining({
          email: user.email,
          resetUrl: expect.any(String),
        }),
      );
    });

    it('reset token TTL is approximately 1 hour', async () => {
      repo.findByEmail.mockResolvedValue(buildUser({ email: dto.email }));
      const before = Date.now();

      await service.forgotPassword(dto as any);

      const [, , expiresAt] = repo.createVerificationToken.mock.calls[0] as unknown as [
        number,
        string,
        Date,
      ];
      const ttlMs = expiresAt.getTime() - before;
      expect(ttlMs).toBeGreaterThan(59 * 60 * 1000); // at least 59 min
      expect(ttlMs).toBeLessThan(61 * 60 * 1000); // at most 61 min
    });

    it('does NOT log the email or the raw token', async () => {
      repo.findByEmail.mockResolvedValue(buildUser({ email: dto.email }));
      const warnSpy = service['logger'].warn as jest.Mock;
      const logSpy = service['logger'].log as jest.Mock;

      await service.forgotPassword(dto as any);

      const allLogs = [...warnSpy.mock.calls, ...logSpy.mock.calls].flat().join(' ');
      expect(allLogs).not.toContain(dto.email);
      expect(allLogs).not.toContain('raw-token-96hex');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // resetPassword
  // ═══════════════════════════════════════════════════════════════════════════

  describe('resetPassword', () => {
    const dto = { token: 'valid-reset-token', password: 'NewSecurePass1!' };

    it('throws 401 for an invalid or expired token', async () => {
      repo.findAndConsumeVerificationToken.mockResolvedValue(null);

      await expect(service.resetPassword(dto as any)).rejects.toThrow(
        new UnauthorizedException('Invalid or expired reset token'),
      );
    });

    it('does NOT update the password when the token is invalid', async () => {
      repo.findAndConsumeVerificationToken.mockResolvedValue(null);

      await expect(service.resetPassword(dto as any)).rejects.toThrow(UnauthorizedException);

      expect(mockBcryptHash).not.toHaveBeenCalled();
      expect(repo.resetPasswordAndRevokeSessions).not.toHaveBeenCalled();
    });

    it('rejects an already-consumed token (single-use enforced by repository)', async () => {
      // First call: token exists → userId returned
      repo.findAndConsumeVerificationToken.mockResolvedValueOnce(1);
      await service.resetPassword(dto as any);

      // Second call: token deleted by first use → null returned
      repo.findAndConsumeVerificationToken.mockResolvedValueOnce(null);
      await expect(service.resetPassword(dto as any)).rejects.toThrow(
        new UnauthorizedException('Invalid or expired reset token'),
      );
    });

    it('hashes the new password and revokes all sessions on success', async () => {
      repo.findAndConsumeVerificationToken.mockResolvedValue(1);

      await service.resetPassword(dto as any);

      expect(mockBcryptHash).toHaveBeenCalledWith(dto.password, expect.anything());
      expect(repo.resetPasswordAndRevokeSessions).toHaveBeenCalledWith(1, '$2b$10$mocked-hash');
    });

    it('returns null on success (uniform response)', async () => {
      repo.findAndConsumeVerificationToken.mockResolvedValue(1);

      const result = await service.resetPassword(dto as any);

      expect(result).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // verifyEmail
  // ═══════════════════════════════════════════════════════════════════════════

  describe('verifyEmail', () => {
    const dto = { token: 'valid-verify-token' };

    it('throws 401 for an invalid or expired token', async () => {
      repo.findAndConsumeVerificationToken.mockResolvedValue(null);

      await expect(service.verifyEmail(dto as any)).rejects.toThrow(
        new UnauthorizedException('Invalid or expired verification token'),
      );
    });

    it('does NOT mark the user verified when the token is invalid', async () => {
      repo.findAndConsumeVerificationToken.mockResolvedValue(null);

      await expect(service.verifyEmail(dto as any)).rejects.toThrow(UnauthorizedException);

      expect(repo.markEmailVerified).not.toHaveBeenCalled();
    });

    it('rejects an already-consumed token (single-use enforced)', async () => {
      repo.findAndConsumeVerificationToken.mockResolvedValueOnce(1);
      await service.verifyEmail(dto as any);

      repo.findAndConsumeVerificationToken.mockResolvedValueOnce(null);
      await expect(service.verifyEmail(dto as any)).rejects.toThrow(
        new UnauthorizedException('Invalid or expired verification token'),
      );
    });

    it('marks the user email as verified on success', async () => {
      repo.findAndConsumeVerificationToken.mockResolvedValue(1);

      await service.verifyEmail(dto as any);

      expect(repo.markEmailVerified).toHaveBeenCalledWith(1);
    });

    it('returns null on success', async () => {
      repo.findAndConsumeVerificationToken.mockResolvedValue(1);

      const result = await service.verifyEmail(dto as any);

      expect(result).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // logout
  // ═══════════════════════════════════════════════════════════════════════════

  describe('logout', () => {
    it('revokes the specific session when a refresh token is provided', async () => {
      await service.logout(1, 'raw-refresh-token');

      expect(repo.revokeRefreshToken).toHaveBeenCalledWith('raw-refresh-token');
      expect(repo.revokeAllUserSessions).not.toHaveBeenCalled();
    });

    it('revokes ALL sessions when no refresh token is provided (fallback)', async () => {
      await service.logout(1);

      expect(repo.revokeAllUserSessions).toHaveBeenCalledWith(1);
      expect(repo.revokeRefreshToken).not.toHaveBeenCalled();
    });
  });
});
