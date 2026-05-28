import { Injectable } from '@nestjs/common';
import { type Prisma, TodoStatus } from '@prisma/client';
import { PrismaService } from '../../../services/database/prisma.service';
import { type CreateTodoDto } from './dto/create-todo.dto';
import { type UpdateTodoDto } from './dto/update-todo.dto';
import { type QueryTodoDto } from './dto/query-todo.dto';

/**
 * All Prisma queries for the todos domain.
 * Every query is scoped to a userId to prevent cross-user data access.
 */
@Injectable()
export class TodosRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a todo and updates the user's last_login in a single transaction.
   * Demonstrates the guide's prisma.$transaction pattern.
   */
  async createWithTransaction(userId: number, dto: CreateTodoDto) {
    return this.prisma.$transaction(async (tx) => {
      const todo = await tx.todo.create({
        data: {
          title: dto.title,
          description: dto.description ?? null,
          status: dto.status ?? TodoStatus.PENDING,
          userId,
        },
      });

      // Record the activity (user's last interaction)
      await tx.user.update({
        where: { id: userId },
        data: { last_login: new Date() },
      });

      return todo;
    });
  }

  async findAll(userId: number, query: QueryTodoDto) {
    const { page = 1, limit = 10, status, search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.TodoWhereInput = {
      userId,
      deletedAt: null,
      ...(status && { status }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.todo.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.todo.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(id: number, userId: number) {
    return this.prisma.todo.findFirst({
      where: { id, userId, deletedAt: null },
    });
  }

  async update(id: number, userId: number, dto: UpdateTodoDto) {
    // updateMany accepts non-unique where fields; ownership is pre-verified by service.findOne
    await this.prisma.todo.updateMany({
      where: { id, userId, deletedAt: null },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });
    return this.prisma.todo.findFirst({ where: { id, userId } });
  }

  async softDelete(id: number, userId: number) {
    // updateMany accepts non-unique where fields; ownership is pre-verified by service.findOne
    await this.prisma.todo.updateMany({
      where: { id, userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }
}
