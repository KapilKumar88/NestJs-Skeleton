import { VersioningType } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  const port = config.get<number>('app.port') ?? 3030;
  const nodeEnv = config.get<string>('app.nodeEnv') ?? 'development';
  const bodyLimit = config.get<string>('app.bodyLimit') ?? '1mb';
  const corsOrigins = config.get<string[]>('app.corsOrigins') ?? [];

  // ── Security headers (helmet) ────────────────────────────────────────
  // Sets X-DNS-Prefetch-Control, X-Frame-Options, X-Content-Type-Options,
  // Strict-Transport-Security, X-Download-Options, X-Permitted-Cross-Domain-Policies, etc.
  app.use(helmet());

  // ── CORS — env-driven allowlist, deny by default ─────────────────────
  // Origins are read from CORS_ORIGINS (comma-separated). Empty = deny all.
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : false,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
  });

  // ── Request body size limits — prevent payload DoS ───────────────────
  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ extended: true, limit: bodyLimit }));

  // ── URI versioning ───────────────────────────────────────────────────
  // Controllers use @Controller({ version: '1' }) → routes under /v1/...
  app.enableVersioning({ type: VersioningType.URI });

  // ── Global response shaping ──────────────────────────────────────────
  const reflector = app.get(Reflector);
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor(), new TransformInterceptor(reflector));

  // Global Zod validation — validates any DTO built with createZodDto(schema)
  app.useGlobalPipes(new ZodValidationPipe());

  // ── Swagger — disabled in production ─────────────────────────────────
  // Do not expose debug routes or internal API schemas publicly.
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('API docs')
      .setDescription('API docs')
      .setVersion('1.0')
      .addBearerAuth()
      .addServer(`http://localhost:${port}/`, 'Local Server')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    // cleanupOpenApiDoc post-processes Zod schema types for proper OpenAPI output
    SwaggerModule.setup('api-docs', app, cleanupOpenApiDoc(document));
  }

  await app.listen(port);
}
void bootstrap();
