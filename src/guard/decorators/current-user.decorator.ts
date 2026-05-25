import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * Extracts the authenticated user (or a specific field) from request.user.
 * The user is set by JwtStrategy.validate().
 *
 * Usage:
 *   @CurrentUser()                   // whole user object { id, email }
 *   @CurrentUser('id')               // just the id
 */
export const CurrentUser = createParamDecorator(
  (field: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request & { user: any }>();
    const user = request.user;
    return field ? user?.[field] : user;
  },
);
