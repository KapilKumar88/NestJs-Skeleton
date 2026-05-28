import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { TodosService } from './todos.service';
import { CreateTodoDto } from './dto/create-todo.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';
import { QueryTodoDto } from './dto/query-todo.dto';
import { CurrentUser } from '../../../guard/decorators/current-user.decorator';
import { ResponseMessage } from '../../../common/decorators/response-message.decorator';

@ApiTags('Todos')
@ApiBearerAuth()
@Controller({ path: 'todos', version: '1' })
export class TodosController {
  constructor(private readonly todosService: TodosService) {}

  // ─── Create ──────────────────────────────────────────────────────────────────

  @Post()
  @ResponseMessage('Todo created successfully')
  @ApiOperation({ summary: 'Create a new todo' })
  @ApiResponse({ status: 201, description: 'Todo created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 422, description: 'Validation error' })
  async create(@CurrentUser('id') userId: number, @Body() dto: CreateTodoDto) {
    return this.todosService.create(userId, dto);
  }

  // ─── List ─────────────────────────────────────────────────────────────────────

  @Get()
  @ResponseMessage('Todos retrieved successfully')
  @ApiOperation({
    summary: 'List todos for the current user (paginated + filterable)',
  })
  @ApiResponse({
    status: 200,
    description: '{ data: Todo[], total, page, limit }',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(@CurrentUser('id') userId: number, @Query() query: QueryTodoDto) {
    return this.todosService.findAll(userId, query);
  }

  // ─── Get One ─────────────────────────────────────────────────────────────────

  @Get(':id')
  @ResponseMessage('Todo retrieved successfully')
  @ApiOperation({
    summary: 'Get a single todo by ID (must belong to the current user)',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Todo found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Todo not found' })
  async findOne(@CurrentUser('id') userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.todosService.findOne(id, userId);
  }

  // ─── Update ───────────────────────────────────────────────────────────────────

  @Patch(':id')
  @ResponseMessage('Todo updated successfully')
  @ApiOperation({ summary: 'Update a todo (must belong to the current user)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Todo updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Todo not found' })
  @ApiResponse({ status: 422, description: 'Validation error' })
  async update(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTodoDto,
  ) {
    return this.todosService.update(id, userId, dto);
  }

  // ─── Delete ───────────────────────────────────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Todo deleted successfully')
  @ApiOperation({
    summary: 'Soft-delete a todo (must belong to the current user)',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Todo soft-deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Todo not found' })
  async remove(@CurrentUser('id') userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.todosService.remove(id, userId);
  }
}
