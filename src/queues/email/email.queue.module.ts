import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EMAIL_QUEUE, EmailProcessor } from './email.processor';

@Module({
  imports: [BullModule.registerQueue({ name: EMAIL_QUEUE })],
  providers: [EmailProcessor],
  exports: [
    BullModule, // Export so AuthModule can inject the queue
  ],
})
export class EmailQueueModule {}
