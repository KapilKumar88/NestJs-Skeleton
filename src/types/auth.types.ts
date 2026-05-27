/**
 * Auth-related shared types.
 */

/** Shape of the decoded JWT access-token payload. */
export interface JwtPayload {
  sub: number;
  email: string;
  iat?: number;
  exp?: number;
}
