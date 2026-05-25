import { VersioningType } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT || 3000;

  // Enable URI versioning — controllers use @Controller({ version: '1' }) → /v1/...
  app.enableVersioning({ type: VersioningType.URI });

  // Global response shaping
  const reflector = app.get(Reflector);
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(reflector),
  );

  // Global Zod validation — validates any DTO built with createZodDto(schema)
  app.useGlobalPipes(new ZodValidationPipe());

  const config = new DocumentBuilder()
    .setTitle('API docs')
    .setDescription('API docs')
    .setVersion('1.0')
    .addBearerAuth()
    .addServer(`http://localhost:${port}/`, 'Local Server')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  // cleanupOpenApiDoc post-processes Zod schema types for proper OpenAPI output
  SwaggerModule.setup('api-docs', app, cleanupOpenApiDoc(document));

  await app.listen(port);
}
bootstrap();
