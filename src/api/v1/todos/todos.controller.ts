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
import {
  ApiNotFoundErrorResponse,
  ApiProtectedEndpointResponses,
  ApiValidationErrorResponse,
} from '../../../common/swagger/responses.swagger';

const TODO_EXAMPLE = {
  id: 1,
  title: 'Buy groceries',
  description: 'Milk, eggs, bread',
  status: 'PENDING',
  userId: 1,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  deletedAt: null,
};

@ApiTags('Todos')
@ApiBearerAuth()
@Controller({ path: 'todos', version: '1' })
export class TodosController {
  constructor(private readonly todosService: TodosService) {}

  // ─── Create ──────────────────────────────────────────────────────────────────

  @Post()
  @ResponseMessage('Todo created successfully')
  @ApiOperation({ summary: 'Create a new todo' })
  @ApiResponse({
    status: 201,
    description: 'Todo created successfully',
    schema: {
      example: {
        success: true,
        message: 'Todo created successfully',
        data: TODO_EXAMPLE,
      },
    },
  })
  @ApiValidationErrorResponse()
  @ApiProtectedEndpointResponses()
  async create(@CurrentUser('id') userId: number, @Body() dto: CreateTodoDto) {
    return this.todosService.create(userId, dto);
  }

  // ─── List ─────────────────────────────────────────────────────────────────────

  @Get()
  @ResponseMessage('Todos retrieved successfully')
  @ApiOperation({ summary: 'List todos for the current user (paginated + filterable)' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of todos belonging to the authenticated user',
    schema: {
      example: {
        success: true,
        message: 'Todos retrieved successfully',
        data: {
          items: [TODO_EXAMPLE],
          total: 1,
          page: 1,
          limit: 10,
        },
      },
    },
  })
  @ApiProtectedEndpointResponses()
  async findAll(@CurrentUser('id') userId: number, @Query() query: QueryTodoDto) {
    return this.todosService.findAll(userId, query);
  }

  // ─── Get One ─────────────────────────────────────────────────────────────────

  @Get(':id')
  @ResponseMessage('Todo retrieved successfully')
  @ApiOperation({ summary: 'Get a single todo by ID (must belong to the current user)' })
  @ApiParam({ name: 'id', type: Number, description: 'Todo ID' })
  @ApiResponse({
    status: 200,
    description: 'Todo found',
    schema: {
      example: { success: true, message: 'Todo retrieved successfully', data: TODO_EXAMPLE },
    },
  })
  @ApiNotFoundErrorResponse('Todo')
  @ApiProtectedEndpointResponses()
  async findOne(@CurrentUser('id') userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.todosService.findOne(id, userId);
  }

  // ─── Update ───────────────────────────────────────────────────────────────────

  @Patch(':id')
  @ResponseMessage('Todo updated successfully')
  @ApiOperation({ summary: 'Update a todo (must belong to the current user)' })
  @ApiParam({ name: 'id', type: Number, description: 'Todo ID' })
  @ApiResponse({
    status: 200,
    description: 'Todo updated successfully',
    schema: {
      example: {
        success: true,
        message: 'Todo updated successfully',
        data: { ...TODO_EXAMPLE, title: 'Updated title', status: 'IN_PROGRESS' },
      },
    },
  })
  @ApiValidationErrorResponse()
  @ApiNotFoundErrorResponse('Todo')
  @ApiProtectedEndpointResponses()
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
  @ApiOperation({ summary: 'Soft-delete a todo (must belong to the current user)' })
  @ApiParam({ name: 'id', type: Number, description: 'Todo ID' })
  @ApiResponse({
    status: 200,
    description: 'Todo soft-deleted',
    schema: {
      example: { success: true, message: 'Todo deleted successfully', data: { deleted: true } },
    },
  })
  @ApiNotFoundErrorResponse('Todo')
  @ApiProtectedEndpointResponses()
  async remove(@CurrentUser('id') userId: number, @Param('id', ParseIntPipe) id: number) {
    return this.todosService.remove(id, userId);
  }
}
