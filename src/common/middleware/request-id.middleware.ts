import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';

/**
 * Assigns a unique request ID to every inbound request.
 *
 * - Reads `x-request-id` from the incoming header if the client/gateway provides one.
 * - Generates a UUID v4 if none is present.
 * - Echoes the ID back on the response header so callers can correlate log entries.
 *
 * All log lines in LoggingInterceptor and HttpExceptionFilter include this ID
 * so distributed traces can be tied together in server logs.
 *
 * Security rule: include correlation/request IDs in logs.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const id =
      (req.headers['x-request-id'] as string | undefined) || randomUUID();
    // Normalise — ensure downstream code can rely on req.headers['x-request-id']
    req.headers['x-request-id'] = id;
    res.setHeader('x-request-id', id);
    next();
  }
}
