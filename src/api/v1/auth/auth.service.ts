import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as bcrypt from 'bcrypt';
import { AuthRepository } from './auth.repository';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { EMAIL_QUEUE } from '../../../queues/email/email.processor';

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

  async register(dto: RegisterDto) {
    // Email uniqueness check (previously handled by class-validator async rule)
    const existing = await this.authRepository.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already taken, please try another');
    }

    const salt = await bcrypt.genSalt();
    const passwordHash = await bcrypt.hash(dto.password, salt);

    const user = await this.authRepository.createUser({
      email: dto.email,
      name: dto.name,
      password: passwordHash,
    });

    const tokens = await this.generateTokens(user.id, user.email);
    await this.authRepository.updateHashedRefreshToken(
      user.id,
      tokens.refreshToken,
    );

    // Enqueue welcome email (non-blocking; failure won't affect registration)
    this.emailQueue
      .add('welcome', { userId: user.id, email: user.email, name: user.name })
      .catch((err) =>
        this.logger.warn(`Failed to enqueue welcome email: ${err.message}`),
      );

    this.logger.log(`User registered: ${user.email}`);
    return { user, ...tokens };
  }

  // ─── Login ───────────────────────────────────────────────────────────────────

  async login(dto: LoginDto) {
    const user = await this.authRepository.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user.id, user.email);
    await Promise.all([
      this.authRepository.updateHashedRefreshToken(
        user.id,
        tokens.refreshToken,
      ),
      this.authRepository.updateLastLogin(user.id),
    ]);

    this.logger.log(`User logged in: ${user.email}`);
    return {
      user: { id: user.id, email: user.email, name: user.name },
      ...tokens,
    };
  }

  // ─── Refresh ─────────────────────────────────────────────────────────────────

  async refreshTokens(dto: RefreshTokenDto) {
    let payload: { sub: number; email: string };

    try {
      payload = this.jwtService.verify(dto.refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.authRepository.findById(payload.sub);
    if (!user?.hashedRefreshToken) {
      throw new UnauthorizedException('Access denied — please log in again');
    }

    const tokenMatch = await bcrypt.compare(
      dto.refreshToken,
      user.hashedRefreshToken,
    );
    if (!tokenMatch) {
      throw new UnauthorizedException(
        'Refresh token mismatch — please log in again',
      );
    }

    // Token rotation: issue new pair, invalidate the old one
    const tokens = await this.generateTokens(user.id, user.email);
    await this.authRepository.updateHashedRefreshToken(
      user.id,
      tokens.refreshToken,
    );

    return tokens;
  }

  // ─── Logout ──────────────────────────────────────────────────────────────────

  async logout(userId: number) {
    await this.authRepository.updateHashedRefreshToken(userId, null);
    this.logger.log(`User logged out: ${userId}`);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async generateTokens(userId: number, email: string) {
    const accessPayload = { sub: userId, email };
    const refreshPayload = { sub: userId };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: this.configService.get<string>('jwt.refreshExpiresIn'),
      }),
    ]);

    return { accessToken, refreshToken };
  }
}
