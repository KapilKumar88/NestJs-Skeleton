import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { DatabaseModule } from './services/database/database.module';
import { AuthModule } from './api/v1/auth/auth.module';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import redisConfig from './config/redis.config';
import mailConfig from './config/mail.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig, redisConfig, mailConfig],
    }),
    DatabaseModule,
    AuthModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
