import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { Public } from '../../../guard/decorators/public.decorator';
import { CurrentUser } from '../../../guard/decorators/current-user.decorator';
import { ResponseMessage } from '../../../common/decorators/response-message.decorator';

@ApiTags('Auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ─── Register ────────────────────────────────────────────────────────────────

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('User registered successfully')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({
    status: 201,
    description: 'User created — returns user + access & refresh tokens',
  })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  @ApiResponse({ status: 422, description: 'Validation error' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // ─── Login ───────────────────────────────────────────────────────────────────

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Login successful')
  @ApiOperation({ summary: 'Authenticate and receive tokens' })
  @ApiResponse({
    status: 200,
    description: 'Returns user + access & refresh tokens',
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 422, description: 'Validation error' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // ─── Refresh ─────────────────────────────────────────────────────────────────

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Tokens refreshed')
  @ApiOperation({
    summary: 'Rotate refresh token and obtain a new access token',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns new access & refresh tokens',
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto);
  }

  // ─── Logout ──────────────────────────────────────────────────────────────────

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Logged out successfully')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Revoke the refresh token (requires valid access token)',
  })
  @ApiResponse({ status: 200, description: 'Refresh token revoked' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — missing or invalid access token',
  })
  async logout(@CurrentUser('id') userId: number) {
    await this.authService.logout(userId);
    return null;
  }
}
