import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthenticationModule } from './modules/authentication/authentication.module';
import { EmailAlreadyExist } from './custom_validation/email-already-exists.rule';
import { UserService } from './modules/user/user.service';
import jwtConfig from './config/jwt.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [jwtConfig],
    }),
    PrismaModule,
    AuthenticationModule,
  ],
  controllers: [AppController],
  providers: [AppService, EmailAlreadyExist, UserService],
})
export class AppModule {}
