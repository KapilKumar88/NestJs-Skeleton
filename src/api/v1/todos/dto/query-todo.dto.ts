import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { TodoStatus } from '@prisma/client';

export const queryTodoSchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10).optional(),
  status: z.enum([TodoStatus.PENDING, TodoStatus.IN_PROGRESS, TodoStatus.DONE]).optional(),
  search: z.string().trim().optional(),
});

export class QueryTodoDto extends createZodDto(queryTodoSchema) {}
