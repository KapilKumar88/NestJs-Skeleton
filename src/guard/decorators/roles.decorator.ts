import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Marks a route with required roles.
 * A RolesGuard can read this metadata and enforce it.
 * (Defined now for future use; enforcement requires a role column on User.)
 *
 * Usage:
 *   @Roles('admin')
 *   @Get('admin-only')
 *   adminOnly() { ... }
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
