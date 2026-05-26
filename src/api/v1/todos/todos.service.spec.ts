import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TodosService } from './todos.service';
import { TodosRepository } from './todos.repository';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const buildTodo = (overrides?: Record<string, unknown>) => ({
  id: 1,
  userId: 1,
  title: 'Test todo',
  description: null,
  status: 'PENDING' as const,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  deletedAt: null,
  ...overrides,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TodosService', () => {
  let service: TodosService;
  let repo: jest.Mocked<TodosRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TodosService,
        {
          provide: TodosRepository,
          useValue: {
            createWithTransaction: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            softDelete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TodosService>(TodosService);
    repo = module.get<TodosRepository>(
      TodosRepository,
    ) as jest.Mocked<TodosRepository>;
  });

  afterEach(() => jest.clearAllMocks());

  // ─── findOne ────────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns the todo when id and userId match', async () => {
      const todo = buildTodo();
      repo.findOne.mockResolvedValue(todo as any);

      await expect(service.findOne(1, 1)).resolves.toEqual(todo);
      expect(repo.findOne).toHaveBeenCalledWith(1, 1);
    });

    it('throws NotFoundException when the todo belongs to a different user (cross-user blocked)', async () => {
      // Repository scopes by userId — returns null for mismatched userId
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOne(1, 99)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for a non-existent todo id', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOne(999, 1)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates the todo when the user owns it', async () => {
      const todo = buildTodo();
      const updated = buildTodo({ title: 'Updated title' });
      repo.findOne.mockResolvedValue(todo as any);
      repo.update.mockResolvedValue(updated as any);

      const result = await service.update(1, 1, {
        title: 'Updated title',
      } as any);
      expect(result).toEqual(updated);
      expect(repo.update).toHaveBeenCalledWith(1, 1, {
        title: 'Updated title',
      });
    });

    it('throws NotFoundException and does NOT update when userId does not match', async () => {
      repo.findOne.mockResolvedValue(null); // ownership check fails

      await expect(
        service.update(1, 99, { title: 'Hack' } as any),
      ).rejects.toThrow(NotFoundException);
      // Ensure repository update was never called (no partial-write exploit)
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  // ─── remove ─────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('soft-deletes the todo when the user owns it', async () => {
      const todo = buildTodo();
      repo.findOne.mockResolvedValue(todo as any);
      repo.softDelete.mockResolvedValue(undefined);

      const result = await service.remove(1, 1);
      expect(result).toEqual({ deleted: true });
      expect(repo.softDelete).toHaveBeenCalledWith(1, 1);
    });

    it('throws NotFoundException and does NOT delete when userId does not match', async () => {
      repo.findOne.mockResolvedValue(null); // ownership check fails

      await expect(service.remove(1, 99)).rejects.toThrow(NotFoundException);
      expect(repo.softDelete).not.toHaveBeenCalled();
    });
  });
});
