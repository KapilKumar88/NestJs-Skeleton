import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../services/database/prisma.service';

/**
 * All Prisma queries for the users domain.
 * Auth-specific queries (create user, update refresh token) live in AuthRepository.
 */
@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: number) {
    // findFirst allows combining unique + non-unique conditions (deletedAt: null)
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        last_login: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async countByEmail(email: string): Promise<number> {
    return this.prisma.user.count({ where: { email } });
  }
}
