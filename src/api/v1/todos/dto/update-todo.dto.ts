import { z } from 'zod';
import { TodoStatus } from '@prisma/client';

export const updateTodoSchema = z.object({
  title: z.string().min(1).max(200).trim().optional(),
  description: z.string().max(1000).trim().optional(),
  status: z
    .enum([TodoStatus.PENDING, TodoStatus.IN_PROGRESS, TodoStatus.COMPLETED])
    .optional(),
});

export type UpdateTodoDto = z.infer<typeof updateTodoSchema>;
