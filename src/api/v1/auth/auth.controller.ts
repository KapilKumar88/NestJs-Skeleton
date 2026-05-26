import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
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

@ApiTags('Auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ─── Register ────────────────────────────────────────────────────────────────

  // Strict limit: 10 requests per 60 s per IP — prevents account-creation spam
  @Throttle({ default: { ttl: seconds(60), limit: 10 } })
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage(
    'If this email is new to us, a verification link has been sent',
  )
  @ApiOperation({
    summary: 'Register a new user',
    description:
      'Enumeration-safe: always returns 201. A verification email is sent for new accounts; ' +
      'an "account already exists" notice is sent for duplicates. No tokens are issued until the email is verified.',
  })
  @ApiResponse({
    status: 201,
    description:
      'Request accepted — check your email for the verification link',
  })
  @ApiResponse({ status: 422, description: 'Validation error' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async register(
    @Body() dto: RegisterDto,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.authService.register(dto, requestId);
  }

  // ─── Login ───────────────────────────────────────────────────────────────────

  // Strict limit: 10 requests per 60 s per IP — prevents brute-force credential attacks
  @Throttle({ default: { ttl: seconds(60), limit: 10 } })
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Login successful')
  @ApiOperation({ summary: 'Authenticate and receive tokens' })
  @ApiResponse({
    status: 200,
    description: 'Returns user + access & refresh tokens',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials, or email not yet verified',
  })
  @ApiResponse({ status: 422, description: 'Validation error' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async login(
    @Body() dto: LoginDto,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.authService.login(dto, requestId);
  }

  // ─── Verify Email ─────────────────────────────────────────────────────────────

  // Strict limit: 20 requests per 60 s per IP — token is single-use anyway
  @Throttle({ default: { ttl: seconds(60), limit: 20 } })
  @Public()
  @Get('verify-email')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Email verified successfully. You may now log in.')
  @ApiOperation({
    summary: 'Verify email address via token from verification email',
    description:
      'Consumes the single-use token. Returns 401 for any invalid or expired token.',
  })
  @ApiQuery({
    name: 'token',
    required: true,
    description: 'Verification token',
  })
  @ApiResponse({ status: 200, description: 'Email verified' })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired verification token',
  })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async verifyEmail(
    @Query() dto: VerifyEmailDto,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.authService.verifyEmail(dto, requestId);
  }

  // ─── Resend Verification ──────────────────────────────────────────────────────

  // Strict limit: 5 requests per 60 s per IP — prevents email-bombing
  @Throttle({ default: { ttl: seconds(60), limit: 5 } })
  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage(
    'If your email is registered and unverified, a new link has been sent',
  )
  @ApiOperation({
    summary: 'Resend email verification link',
    description:
      'Enumeration-safe: same response whether or not the email exists / is already verified.',
  })
  @ApiResponse({
    status: 200,
    description: 'Request accepted — check your email',
  })
  @ApiResponse({ status: 422, description: 'Validation error' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async resendVerification(
    @Body() dto: ResendVerificationDto,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.authService.resendVerification(dto, requestId);
  }

  // ─── Forgot Password ──────────────────────────────────────────────────────────

  // Strict limit: 5 requests per 60 s per IP — prevents reset-link flooding
  @Throttle({ default: { ttl: seconds(60), limit: 5 } })
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage(
    'If an account with that email exists, a reset link has been sent',
  )
  @ApiOperation({
    summary: 'Request a password reset link',
    description:
      'Enumeration-safe: always returns 200 regardless of whether the email is registered.',
  })
  @ApiResponse({
    status: 200,
    description: 'Request accepted — check your email',
  })
  @ApiResponse({ status: 422, description: 'Validation error' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.authService.forgotPassword(dto, requestId);
  }

  // ─── Reset Password ───────────────────────────────────────────────────────────

  // Strict limit: 5 requests per 60 s per IP — token is single-use anyway
  @Throttle({ default: { ttl: seconds(60), limit: 5 } })
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage(
    'Password reset successfully. Please log in with your new password.',
  )
  @ApiOperation({
    summary: 'Reset password using a valid reset token',
    description:
      'Consumes the single-use token, updates the password, and revokes all active sessions.',
  })
  @ApiResponse({
    status: 200,
    description: 'Password updated; all sessions revoked',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired reset token',
  })
  @ApiResponse({ status: 422, description: 'Validation error' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.authService.resetPassword(dto, requestId);
  }

  // ─── Refresh ─────────────────────────────────────────────────────────────────

  // Strict limit: 10 requests per 60 s per IP — prevents refresh-token brute force
  @Throttle({ default: { ttl: seconds(60), limit: 10 } })
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
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.authService.refreshTokens(dto, requestId);
  }

  // ─── Logout ──────────────────────────────────────────────────────────────────

  // Protected by JWT (not @Public) — global throttle rate applies
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
  @ApiResponse({ status: 200, description: 'Session(s) revoked' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — missing or invalid access token',
  })
  async logout(
    @CurrentUser('id') userId: number,
    @Body() dto: LogoutDto,
    @Headers('x-request-id') requestId?: string,
  ) {
    await this.authService.logout(userId, dto.refreshToken, requestId);
    return null;
  }
}
