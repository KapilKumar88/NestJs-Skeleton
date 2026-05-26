import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

/**
 * Logs every HTTP request/response with timing and the correlation request ID
 * injected by RequestIdMiddleware.
 *
 * Security rule: include correlation/request IDs in logs.
 * Never logs request bodies (may contain passwords, tokens, PII).
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<Request>();
    const { method, originalUrl } = req;
    const requestId =
      (req.headers['x-request-id'] as string | undefined) ?? '-';
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const res = context.switchToHttp().getResponse<Response>();
        const elapsed = Date.now() - start;
        this.logger.log(
          `[${requestId}] ${method} ${originalUrl} → ${res.statusCode} (${elapsed}ms)`,
        );
      }),
    );
  }
}
