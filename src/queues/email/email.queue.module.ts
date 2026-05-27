import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EmailProcessor } from './email.processor';
import { EMAIL_QUEUE } from '../../common/constants';

@Module({
  imports: [BullModule.registerQueue({ name: EMAIL_QUEUE })],
  providers: [EmailProcessor],
  exports: [
    BullModule, // Export so AuthModule can inject the queue
  ],
})
export class EmailQueueModule {}
