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

/** Access + refresh token pair returned on login and refresh. */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/** Minimal user shape embedded in login/refresh responses. */
export interface AuthUser {
  id: number;
  email: string;
  name: string | null;
}

/** Full login response — user info + token pair. */
export interface LoginResponse extends TokenPair {
  user: AuthUser;
}
