import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { HttpExceptionFilter } from './http-exception.filter';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const buildHost = (requestId?: string): ArgumentsHost => {
  const mockJson = jest.fn();
  const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
  return {
    switchToHttp: () => ({
      getResponse: () => ({ status: mockStatus }),
      getRequest: () => ({
        headers: { 'x-request-id': requestId },
        method: 'GET',
        url: '/test',
      }),
    }),
  } as unknown as ArgumentsHost;
};

const captureResponse = (
  filter: HttpExceptionFilter,
  exception: unknown,
  requestId?: string,
) => {
  const host = buildHost(requestId);
  filter.catch(exception, host);
  const httpContext = host.switchToHttp();
  const res = httpContext.getResponse<{ status: jest.Mock }>();
  const statusCall = res.status.mock.calls[0][0] as number;
  const body = (res.status.mock.results[0].value as { json: jest.Mock }).json
    .mock.calls[0][0] as Record<string, unknown>;
  return { status: statusCall, body };
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
  });

  describe('HttpException (intentional, safe messages)', () => {
    it('shapes a string-message HttpException into the standard error envelope', () => {
      const { status, body } = captureResponse(
        filter,
        new HttpException('Not found', HttpStatus.NOT_FOUND),
      );
      expect(status).toBe(404);
      expect(body).toEqual({
        success: false,
        message: 'Not found',
        data: null,
      });
    });

    it('extracts message from object-style HttpException response', () => {
      const { status, body } = captureResponse(
        filter,
        new HttpException(
          { message: 'Validation failed', error: 'Bad Request' },
          422,
        ),
      );
      expect(status).toBe(422);
      expect(body.message).toBe('Validation failed');
    });

    it('joins array messages (Zod/class-validator style) with semicolons', () => {
      const { body } = captureResponse(
        filter,
        new HttpException(
          { message: ['field a is required', 'field b is invalid'] },
          422,
        ),
      );
      expect(body.message).toBe('field a is required; field b is invalid');
    });
  });

  describe('PrismaClientKnownRequestError — must never leak internals', () => {
    it('returns generic "Internal server error" (not Prisma error detail)', () => {
      const prismaErr = new PrismaClientKnownRequestError(
        'Unique constraint failed on column: email',
        { code: 'P2002', clientVersion: '4.0.0' },
      );
      const { status, body } = captureResponse(filter, prismaErr);
      expect(status).toBe(500);
      expect(body.message).toBe('Internal server error');
    });

    it('response body does not contain the Prisma error code', () => {
      const prismaErr = new PrismaClientKnownRequestError('msg', {
        code: 'P2025',
        clientVersion: '4.0.0',
      });
      const { body } = captureResponse(filter, prismaErr);
      expect(JSON.stringify(body)).not.toContain('P2025');
    });

    it('response body does not contain the raw constraint message', () => {
      const prismaErr = new PrismaClientKnownRequestError(
        'SENSITIVE_COLUMN_NAME constraint failed',
        { code: 'P2002', clientVersion: '4.0.0' },
      );
      const { body } = captureResponse(filter, prismaErr);
      expect(JSON.stringify(body)).not.toContain('SENSITIVE_COLUMN_NAME');
    });
  });

  describe('Unhandled Error — must never leak internals', () => {
    it('returns generic "Internal server error" (not the thrown message)', () => {
      const { status, body } = captureResponse(
        filter,
        new Error('JWT_SECRET=supersecret leaked in stack trace'),
      );
      expect(status).toBe(500);
      expect(body.message).toBe('Internal server error');
    });

    it('response body does not contain the raw exception.message', () => {
      const secret = 'DB_PASSWORD=hunter2';
      const { body } = captureResponse(filter, new Error(secret));
      expect(JSON.stringify(body)).not.toContain(secret);
    });

    it('response always has data: null for 500s', () => {
      const { body } = captureResponse(filter, new Error('anything'));
      expect(body.data).toBeNull();
    });
  });

  describe('Non-Error throwables', () => {
    it('returns generic 500 for thrown string', () => {
      const { status, body } = captureResponse(filter, 'something went wrong');
      expect(status).toBe(500);
      expect(body.message).toBe('Internal server error');
    });

    it('returns generic 500 for thrown plain object', () => {
      const { status, body } = captureResponse(filter, { internal: 'secret' });
      expect(status).toBe(500);
      expect(body.message).toBe('Internal server error');
      expect(JSON.stringify(body)).not.toContain('secret');
    });
  });

  describe('Response envelope shape', () => {
    it('always has { success: false, message: string, data: null }', () => {
      const { body } = captureResponse(
        filter,
        new HttpException('Forbidden', 403),
      );
      expect(body).toMatchObject({
        success: false,
        message: expect.any(String),
        data: null,
      });
    });
  });
});
