import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CurrentUser } from '../../../guard/decorators/current-user.decorator';
import { ResponseMessage } from '../../../common/decorators/response-message.decorator';
import {
  ApiNotFoundErrorResponse,
  ApiProtectedEndpointResponses,
} from '../../../common/swagger/responses.swagger';

@ApiTags('Users')
@ApiBearerAuth()
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ResponseMessage('Profile retrieved successfully')
  @ApiOperation({ summary: "Get the authenticated user's profile" })
  @ApiResponse({
    status: 200,
    description: 'Authenticated user profile — password and internal fields excluded',
    schema: {
      example: {
        success: true,
        message: 'Profile retrieved successfully',
        data: {
          id: 1,
          email: 'user@example.com',
          name: 'John Doe',
          emailVerified: true,
          emailVerifiedAt: '2024-01-01T00:00:00.000Z',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      },
    },
  })
  @ApiNotFoundErrorResponse('User')
  @ApiProtectedEndpointResponses()
  async getMe(@CurrentUser('id') userId: number) {
    return this.usersService.findById(userId);
  }
}
