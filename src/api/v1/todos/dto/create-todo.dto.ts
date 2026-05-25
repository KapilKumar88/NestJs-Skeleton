import { z } from 'zod';
import { TodoStatus } from '@prisma/client';

export const createTodoSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200).trim(),
  description: z.string().max(1000).trim().optional(),
  status: z
    .enum([TodoStatus.PENDING, TodoStatus.IN_PROGRESS, TodoStatus.COMPLETED])
    .optional()
    .default(TodoStatus.PENDING),
});

export type CreateTodoDto = z.infer<typeof createTodoSchema>;
