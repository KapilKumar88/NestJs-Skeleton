import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle, seconds } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { LogoutDto } from './dto/logout.dto';
import { Public } from '../../../guard/decorators/public.decorator';
import { CurrentUser } from '../../../guard/decorators/current-user.decorator';
import { ResponseMessage } from '../../../common/decorators/response-message.decorator';
import {
  ApiProtectedEndpointResponses,
  ApiPublicThrottledQueryResponses,
  ApiPublicThrottledResponses,
  ApiUnauthorizedErrorResponse,
} from '../../../common/swagger/responses.swagger';

const EMPTY_SUCCESS = (message: string) => ({
  example: { success: true, message, data: null },
});

@ApiTags('Auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ─── Register ────────────────────────────────────────────────────────────────

  @Throttle({ default: { ttl: seconds(60), limit: 10 } })
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('If this email is new to us, a verification link has been sent')
  @ApiOperation({
    summary: 'Register a new user',
    description:
      'Enumeration-safe: always returns 201. A verification email is sent for new accounts; ' +
      'an "account already exists" notice is sent for duplicates. No tokens are issued until the email is verified.',
  })
  @ApiResponse({
    status: 201,
    description:
      'Accepted — a verification email has been dispatched (new account) or an "already exists" notice (duplicate)',
    schema: EMPTY_SUCCESS('If this email is new to us, a verification link has been sent'),
  })
  @ApiPublicThrottledResponses()
  async register(@Body() dto: RegisterDto, @Headers('x-request-id') requestId?: string) {
    return this.authService.register(dto, requestId);
  }

  // ─── Login ───────────────────────────────────────────────────────────────────

  @Throttle({ default: { ttl: seconds(60), limit: 10 } })
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Login successful')
  @ApiOperation({ summary: 'Authenticate and receive tokens' })
  @ApiResponse({
    status: 200,
    description:
      'Authentication successful — returns access token, refresh token, and user profile',
    schema: {
      example: {
        success: true,
        message: 'Login successful',
        data: {
          accessToken: 'access_token',
          refreshToken: 'refresh_token',
          user: { id: 1, email: 'user@example.com', name: 'John Doe' },
        },
      },
    },
  })
  @ApiUnauthorizedErrorResponse('Invalid credentials')
  @ApiPublicThrottledResponses()
  async login(@Body() dto: LoginDto, @Headers('x-request-id') requestId?: string) {
    return this.authService.login(dto, requestId);
  }

  // ─── Verify Email ─────────────────────────────────────────────────────────────

  @Throttle({ default: { ttl: seconds(60), limit: 20 } })
  @Public()
  @Get('verify-email')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Email verified successfully. You may now log in.')
  @ApiOperation({
    summary: 'Verify email address via token from verification email',
    description: 'Consumes the single-use token. Returns 401 for any invalid or expired token.',
  })
  @ApiQuery({ name: 'token', required: true, description: 'Single-use email verification token' })
  @ApiResponse({
    status: 200,
    description: 'Email verified — the account is now active and login is permitted',
    schema: EMPTY_SUCCESS('Email verified successfully. You may now log in.'),
  })
  @ApiUnauthorizedErrorResponse('Invalid or expired verification token')
  @ApiPublicThrottledQueryResponses()
  async verifyEmail(@Query() dto: VerifyEmailDto, @Headers('x-request-id') requestId?: string) {
    return this.authService.verifyEmail(dto, requestId);
  }

  // ─── Resend Verification ──────────────────────────────────────────────────────

  @Throttle({ default: { ttl: seconds(60), limit: 5 } })
  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('If your email is registered and unverified, a new link has been sent')
  @ApiOperation({
    summary: 'Resend email verification link',
    description:
      'Enumeration-safe: same response whether or not the email exists / is already verified.',
  })
  @ApiResponse({
    status: 200,
    description: 'Accepted — a new verification link has been dispatched if applicable',
    schema: EMPTY_SUCCESS('If your email is registered and unverified, a new link has been sent'),
  })
  @ApiPublicThrottledResponses()
  async resendVerification(
    @Body() dto: ResendVerificationDto,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.authService.resendVerification(dto, requestId);
  }

  // ─── Forgot Password ──────────────────────────────────────────────────────────

  @Throttle({ default: { ttl: seconds(60), limit: 5 } })
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('If an account with that email exists, a reset link has been sent')
  @ApiOperation({
    summary: 'Request a password reset link',
    description:
      'Enumeration-safe: always returns 200 regardless of whether the email is registered.',
  })
  @ApiResponse({
    status: 200,
    description: 'Accepted — a reset link has been dispatched if the email is registered',
    schema: EMPTY_SUCCESS('If an account with that email exists, a reset link has been sent'),
  })
  @ApiPublicThrottledResponses()
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.authService.forgotPassword(dto, requestId);
  }

  // ─── Reset Password ───────────────────────────────────────────────────────────

  @Throttle({ default: { ttl: seconds(60), limit: 5 } })
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Password reset successfully. Please log in with your new password.')
  @ApiOperation({
    summary: 'Reset password using a valid reset token',
    description:
      'Consumes the single-use token, updates the password, and revokes all active sessions.',
  })
  @ApiResponse({
    status: 200,
    description: 'Password updated — all existing sessions have been revoked',
    schema: EMPTY_SUCCESS('Password reset successfully. Please log in with your new password.'),
  })
  @ApiUnauthorizedErrorResponse('Invalid or expired reset token')
  @ApiPublicThrottledResponses()
  async resetPassword(@Body() dto: ResetPasswordDto, @Headers('x-request-id') requestId?: string) {
    return this.authService.resetPassword(dto, requestId);
  }

  // ─── Refresh ─────────────────────────────────────────────────────────────────

  @Throttle({ default: { ttl: seconds(60), limit: 10 } })
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Tokens refreshed')
  @ApiOperation({ summary: 'Rotate refresh token and obtain a new access token' })
  @ApiResponse({
    status: 200,
    description:
      'Token rotation successful — old refresh token is consumed and a new pair is issued',
    schema: {
      example: {
        success: true,
        message: 'Tokens refreshed',
        data: { accessToken: '<token>', refreshToken: '<token>' },
      },
    },
  })
  @ApiUnauthorizedErrorResponse('Invalid or expired refresh token')
  @ApiPublicThrottledResponses()
  async refresh(@Body() dto: RefreshTokenDto, @Headers('x-request-id') requestId?: string) {
    return this.authService.refreshTokens(dto, requestId);
  }

  // ─── Logout ──────────────────────────────────────────────────────────────────

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Logged out successfully')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Revoke the current session (requires valid access token)',
    description:
      'Provide `refreshToken` in the body to revoke only the current session. ' +
      'If omitted, all sessions for the account are revoked.',
  })
  @ApiResponse({
    status: 200,
    description: 'Session(s) revoked successfully',
    schema: EMPTY_SUCCESS('Logged out successfully'),
  })
  @ApiProtectedEndpointResponses()
  async logout(
    @CurrentUser('id') userId: number,
    @Body() dto: LogoutDto,
    @Headers('x-request-id') requestId?: string,
  ) {
    await this.authService.logout(userId, dto.refreshToken, requestId);
    return null;
  }
}
