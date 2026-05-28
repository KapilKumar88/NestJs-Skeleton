import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, type JwtSignOptions } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { EmailQueueModule } from '../../../queues/email/email.queue.module';

@Module({
  imports: [
    // Register JwtModule so AuthService can call jwtService.sign/verify
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
        signOptions: {
          // ConfigService returns string; @nestjs/jwt@11 requires ms.StringValue — safe cast
          // since JWT_EXPIRES_IN is validated by Zod at startup (e.g. '15m', '1h').
          expiresIn: config.get<string>('jwt.expiresIn') as JwtSignOptions['expiresIn'],
        },
      }),
    }),
    EmailQueueModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthRepository],
  exports: [AuthService],
})
export class AuthModule {}
