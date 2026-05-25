import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Global exception filter — catches HttpException (and subclasses) and shapes
 * the error response as:
 *   { success: false, message: string, data: null }
 *
 * Unhandled errors are treated as 500 Internal Server Error.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const resp = exceptionResponse as Record<string, any>;
        // class-validator BadRequestException emits { message: string | string[], ... }
        if (Array.isArray(resp.message)) {
          message = resp.message.join('; ');
        } else if (typeof resp.message === 'string') {
          message = resp.message;
        } else if (typeof resp.error === 'string') {
          message = resp.error;
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message || message;
    }

    // Log 5xx as errors; 4xx as warnings
    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${status}: ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.url} → ${status}: ${message}`,
      );
    }

    response.status(status).json({
      success: false,
      message,
      data: null,
    });
  }
}
