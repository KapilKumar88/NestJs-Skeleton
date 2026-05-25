import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Global database module — PrismaService is available in every module
 * without re-importing this module.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
