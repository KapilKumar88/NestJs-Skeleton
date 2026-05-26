import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule, ThrottlerGuard, seconds } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './services/database/database.module';
import { RedisModule } from './services/redis/redis.module';
import { MailModule } from './services/mail/mail.module';
import { EmailQueueModule } from './queues/email/email.queue.module';
import { GuardModule } from './guard/guard.module';
import { AuthModule } from './api/v1/auth/auth.module';
import { UsersModule } from './api/v1/users/users.module';
import { TodosModule } from './api/v1/todos/todos.module';
import { HealthModule } from './health/health.module';
import { JwtAuthGuard } from './guard/auth/jwt-auth.guard';
import { validateEnv } from './config/env.validation';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import redisConfig from './config/redis.config';
import mailConfig from './config/mail.config';
import securityConfig from './config/security.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        databaseConfig,
        jwtConfig,
        redisConfig,
        mailConfig,
        securityConfig,
      ],
      // Fail closed: app refuses to boot if any required secret is missing or weak
      validate: validateEnv,
    }),
    DatabaseModule,
    RedisModule,
    MailModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('redis.host'),
          port: config.get<number>('redis.port'),
          password: config.get<string>('redis.password') || undefined,
        },
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            // Global default: THROTTLE_LIMIT requests per THROTTLE_TTL seconds
            ttl: seconds(config.get<number>('security.throttleTtl') ?? 60),
            limit: config.get<number>('security.throttleLimit') ?? 100,
          },
        ],
        // Redis-backed storage — limits survive across multiple app instances
        storage: new ThrottlerStorageRedisService({
          host: config.get<string>('redis.host'),
          port: config.get<number>('redis.port'),
          password: config.get<string>('redis.password') || undefined,
        }),
      }),
    }),
    EmailQueueModule,
    GuardModule,
    UsersModule,
    AuthModule,
    TodosModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // ThrottlerGuard runs FIRST — enforces rate limits even on @Public() routes
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // JwtAuthGuard runs second — enforces authentication on protected routes
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Assign x-request-id to every request before guards/interceptors run
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
