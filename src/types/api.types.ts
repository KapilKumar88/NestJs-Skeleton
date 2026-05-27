/**
 * Shared API response shape used by TransformInterceptor and HttpExceptionFilter.
 */

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}
