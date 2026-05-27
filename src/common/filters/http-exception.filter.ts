import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

/**
 * Global exception filter — catches ALL exceptions and shapes the error
 * response as: { success: false, message: string, data: null }
 *
 * Security rules:
 *  - Return generic error messages to users.
 *  - Log detailed errors ONLY on the server with sensitive data redacted.
 *  - Never expose stack traces, SQL errors, file paths, package versions,
 *    internal service names, or debug output to the client.
 *
 * The critical fix vs the original: for non-HttpException errors (Prisma errors,
 * unhandled runtime errors) we previously echoed `exception.message` to the
 * client — leaking Prisma error codes, SQL fragments, file paths, etc.
 * Now those always return "Internal server error" while the full detail is
 * logged server-side with the request correlation ID.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Pull the correlation ID injected by RequestIdMiddleware
    const requestId =
      (request.headers['x-request-id'] as string | undefined) ?? '-';

    // All branches assign status; no safe default needed here
    let status: number;
    let clientMessage = 'Internal server error'; // safe default — never leaks internals

    if (exception instanceof HttpException) {
      // ── Known HTTP exceptions (thrown by our code) ──────────────────────
      // These are intentional and their messages are already safe for clients.
      status = exception.getStatus();
      clientMessage = this.extractClientMessage(exception);

      if (status >= 500) {
        this.logger.error(
          `[${requestId}] HttpException ${request.method} ${request.url} → ${status}: ${clientMessage}`,
          exception.stack,
        );
      } else {
        this.logger.warn(
          `[${requestId}] ${request.method} ${request.url} → ${status}: ${clientMessage}`,
        );
      }
    } else if (exception instanceof PrismaClientKnownRequestError) {
      // ── Prisma ORM errors ───────────────────────────────────────────────
      // Prisma error messages contain SQL fragments, constraint names, table
      // names, and column details — never expose them to clients.
      // Log full detail server-side only.
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      this.logger.error(
        `[${requestId}] PrismaError ${exception.code} ${request.method} ${request.url}`,
        exception.stack,
      );
    } else if (exception instanceof Error) {
      // ── Unhandled runtime errors ────────────────────────────────────────
      // Could be anything — third-party library errors, type errors, etc.
      // Never echo exception.message (may contain file paths, secrets, etc.)
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      this.logger.error(
        `[${requestId}] Unhandled ${exception.constructor.name} ${request.method} ${request.url}`,
        exception.stack,
      );
    } else {
      // ── Non-Error throwables ────────────────────────────────────────────
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      const exceptionStr =
        typeof exception === 'string' ? exception : JSON.stringify(exception);
      this.logger.error(
        `[${requestId}] Unknown exception type ${request.method} ${request.url}: ${exceptionStr}`,
      );
    }

    response.status(status).json({
      success: false,
      message: clientMessage,
      data: null,
    });
  }

  /**
   * Extracts a safe client-facing message from an HttpException response.
   * Falls back to 'Internal server error' if the shape is unrecognised.
   */
  private extractClientMessage(exception: HttpException): string {
    const exceptionResponse = exception.getResponse();

    if (typeof exceptionResponse === 'string') {
      return exceptionResponse;
    }

    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const resp = exceptionResponse as Record<string, unknown>;
      if (Array.isArray(resp.message)) {
        return (resp.message as string[]).map(String).join('; ');
      }
      if (typeof resp.message === 'string') {
        return resp.message;
      }
      if (typeof resp.error === 'string') {
        return resp.error;
      }
    }

    return 'Internal server error';
  }
}
