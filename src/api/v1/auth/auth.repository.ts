import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../services/database/prisma.service';

/**
 * All Prisma queries for the auth domain live here.
 * No business logic — only database access.
 */
@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

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

  /**
   * Stores a bcrypt hash of the given refresh token.
   * Pass `null` to clear (logout).
   */
  async updateHashedRefreshToken(userId: number, refreshToken: string | null) {
    const hashedRefreshToken = refreshToken
      ? await bcrypt.hash(refreshToken, 10)
      : null;

    return this.prisma.user.update({
      where: { id: userId },
      data: { hashedRefreshToken },
    });
  }

  async updateLastLogin(userId: number) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { last_login: new Date() },
    });
  }
}
