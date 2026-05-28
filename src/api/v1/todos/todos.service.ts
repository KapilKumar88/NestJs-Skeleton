import { Injectable, NotFoundException } from '@nestjs/common';
import { TodosRepository } from './todos.repository';
import { type CreateTodoDto } from './dto/create-todo.dto';
import { type UpdateTodoDto } from './dto/update-todo.dto';
import { type QueryTodoDto } from './dto/query-todo.dto';

@Injectable()
export class TodosService {
  constructor(private readonly todosRepository: TodosRepository) {}

  async create(userId: number, dto: CreateTodoDto) {
    return this.todosRepository.createWithTransaction(userId, dto);
  }

  async findAll(userId: number, query: QueryTodoDto) {
    return this.todosRepository.findAll(userId, query);
  }

  async findOne(id: number, userId: number) {
    const todo = await this.todosRepository.findOne(id, userId);
    if (!todo) {
      throw new NotFoundException(`Todo #${id} not found`);
    }
    return todo;
  }

  async update(id: number, userId: number, dto: UpdateTodoDto) {
    // Verify ownership before updating
    await this.findOne(id, userId);
    return this.todosRepository.update(id, userId, dto);
  }

  async remove(id: number, userId: number) {
    // Verify ownership before deleting
    await this.findOne(id, userId);
    await this.todosRepository.softDelete(id, userId);
    return { deleted: true };
  }
}
