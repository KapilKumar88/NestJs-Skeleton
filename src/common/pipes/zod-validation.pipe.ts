import {
  ArgumentMetadata,
  Injectable,
  PipeTransform,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ZodSchema } from 'zod';

/**
 * Validates and transforms incoming data against a Zod schema.
 *
 * Two usage modes:
 *
 * 1. **Per-route** — pass the schema explicitly:
 *    ```ts
 *    @Body(new ZodValidationPipe(loginSchema)) dto: LoginDto
 *    ```
 *
 * 2. **Global** (registered in main.ts) — automatically reads `.schema` from
 *    any DTO class built with `createZodDto(schema)` from nestjs-zod:
 *    ```ts
 *    app.useGlobalPipes(new ZodValidationPipe());
 *    ```
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema?: ZodSchema) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    // Resolve which schema to use
    const schema =
      this.schema ?? this.extractSchemaFromMetatype(metadata.metatype) ?? null;

    // No schema = pass through (primitives, NestJS internals, etc.)
    if (!schema) return value;

    const result = schema.safeParse(value);
    if (result.success) {
      return result.data;
    }

    // Format Zod issues into a human-readable string
    const messages = result.error.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
        return `${path}${issue.message}`;
      })
      .join('; ');

    throw new UnprocessableEntityException(messages);
  }

  /**
   * `createZodDto(schema)` from nestjs-zod attaches the schema as a
   * static property — we read it here for the global-pipe use case.
   */
  private extractSchemaFromMetatype(
    metatype: ArgumentMetadata['metatype'],
  ): ZodSchema | undefined {
    if (metatype && typeof (metatype as any).schema?.safeParse === 'function') {
      return (metatype as any).schema as ZodSchema;
    }
    return undefined;
  }
}
