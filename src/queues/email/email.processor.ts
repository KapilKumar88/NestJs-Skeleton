import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { MailService } from '../../services/mail/mail.service';

export const EMAIL_QUEUE = 'email';

export interface WelcomeEmailJob {
  userId: number;
  email: string;
  name: string;
}

/**
 * Processes jobs from the 'email' BullMQ queue.
 * Handles the 'welcome' job type by sending a welcome email via MailService.
 */
@Processor(EMAIL_QUEUE)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly mailService: MailService) {
    super();
  }

  async process(job: Job<WelcomeEmailJob>): Promise<void> {
    this.logger.log(
      `Processing job ${job.name} #${job.id} for user ${job.data.email}`,
    );

    switch (job.name) {
      case 'welcome':
        await this.mailService.sendWelcome({
          name: job.data.name,
          email: job.data.email,
        });
        this.logger.log(`Welcome email sent to ${job.data.email}`);
        break;

      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }
}
