import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { User } from 'src/interface/user.interface';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly prismaService: PrismaService) {}

  checkEmailExists(email: string): Promise<number> {
    return this.prismaService.user.count({
      where: {
        email,
      },
    });
  }

  create(payload: Prisma.UserCreateInput): Promise<User> {
    return this.prismaService.user.create({
      data: {
        email: payload.email,
        name: payload.name,
        password: payload.password,
      },
      select: {
        email: true,
        name: true,
      },
    });
  }

  findByEmail(email: string): Promise<User> {
    return this.prismaService.user.findUnique({
      where: {
        email,
      },
    });
  }
}
