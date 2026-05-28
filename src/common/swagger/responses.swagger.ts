import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

// ─── Schema builders ──────────────────────────────────────────────────────────

function errSchema(message: string) {
  return { example: { success: false, message, data: null } };
}

// ─── Individual response decorators ──────────────────────────────────────────

export const ApiValidationErrorResponse = () =>
  ApiResponse({
    status: 422,
    description: 'Validation error — one or more fields failed schema validation',
    schema: errSchema('email: Must be a valid email address'),
  });

export const ApiRateLimitResponse = () =>
  ApiResponse({
    status: 429,
    description: 'Too many requests — rate limit exceeded',
    schema: errSchema('ThrottlerException: Too Many Requests'),
  });

export const ApiInternalErrorResponse = () =>
  ApiResponse({
    status: 500,
    description: 'Internal server error',
    schema: errSchema('Internal server error'),
  });

export const ApiUnauthorizedErrorResponse = (message = 'Unauthorized') =>
  ApiResponse({
    status: 401,
    description: 'Unauthorized — missing, invalid, or expired credentials',
    schema: errSchema(message),
  });

export const ApiForbiddenErrorResponse = () =>
  ApiResponse({
    status: 403,
    description: 'Forbidden — authenticated but not authorised to access this resource',
    schema: errSchema('Forbidden'),
  });

export const ApiNotFoundErrorResponse = (resource = 'Resource') =>
  ApiResponse({
    status: 404,
    description: `${resource} not found or inaccessible`,
    schema: errSchema(`${resource} not found`),
  });

// ─── Composite response bundles ───────────────────────────────────────────────

/**
 * Error responses for throttled public endpoints with a request body.
 * Applies: 422 (validation), 429 (rate limit), 500 (server error).
 */
export const ApiPublicThrottledResponses = () =>
  applyDecorators(ApiValidationErrorResponse(), ApiRateLimitResponse(), ApiInternalErrorResponse());

/**
 * Error responses for throttled public endpoints without a request body (e.g. GET).
 * Applies: 429 (rate limit), 500 (server error).
 */
export const ApiPublicThrottledQueryResponses = () =>
  applyDecorators(ApiRateLimitResponse(), ApiInternalErrorResponse());

/**
 * Error responses for all JWT-protected endpoints.
 * Applies: 401 (unauthorized), 403 (forbidden), 500 (server error).
 */
export const ApiProtectedEndpointResponses = () =>
  applyDecorators(
    ApiUnauthorizedErrorResponse(),
    ApiForbiddenErrorResponse(),
    ApiInternalErrorResponse(),
  );
