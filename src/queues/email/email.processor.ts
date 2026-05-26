import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { MailService } from '../../services/mail/mail.service';

export const EMAIL_QUEUE = 'email';

// ─── Job payload types ────────────────────────────────────────────────────────

export interface WelcomeEmailJob {
  userId: number;
  email: string;
  name: string;
}

export interface VerifyEmailJob {
  email: string;
  name: string;
  verifyUrl: string; // contains the raw token — NEVER log this field
}

export interface AccountExistsNoticeJob {
  email: string;
  name: string;
}

export interface PasswordResetJob {
  email: string;
  name: string;
  resetUrl: string; // contains the raw token — NEVER log this field
}

export type AnyEmailJob =
  | WelcomeEmailJob
  | VerifyEmailJob
  | AccountExistsNoticeJob
  | PasswordResetJob;

/**
 * Processes jobs from the 'email' BullMQ queue.
 *
 * Security rules:
 *  - Never log verifyUrl, tokens, or passwords — only log that the email was
 *    sent (or failed) without the sensitive payload.
 *  - Failed email deliveries are logged as warnings and do not re-throw, so
 *    the job is marked completed rather than retried indefinitely.
 */
@Processor(EMAIL_QUEUE)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly mailService: MailService) {
    super();
  }

  async process(job: Job<AnyEmailJob>): Promise<void> {
    // Log job name and id only — never log the payload (may contain tokens/emails)
    this.logger.log(`Processing email job "${job.name}" #${job.id}`);

    switch (job.name) {
      case 'welcome': {
        const data = job.data as WelcomeEmailJob;
        await this.mailService.sendWelcome({
          name: data.name,
          email: data.email,
        });
        this.logger.log(`Welcome email dispatched for job #${job.id}`);
        break;
      }

      case 'verify-email': {
        const data = job.data as VerifyEmailJob;
        await this.mailService.sendVerificationEmail({
          name: data.name,
          email: data.email,
          verifyUrl: data.verifyUrl,
        });
        // verifyUrl is NOT logged — it contains the raw token
        this.logger.log(`Verification email dispatched for job #${job.id}`);
        break;
      }

      case 'account-exists-notice': {
        const data = job.data as AccountExistsNoticeJob;
        await this.mailService.sendAccountExistsNotice({
          name: data.name,
          email: data.email,
        });
        this.logger.log(`Account-exists notice dispatched for job #${job.id}`);
        break;
      }

      case 'password-reset': {
        const data = job.data as PasswordResetJob;
        await this.mailService.sendPasswordReset({
          name: data.name,
          email: data.email,
          resetUrl: data.resetUrl,
        });
        // resetUrl is NOT logged — it contains the raw token
        this.logger.log(`Password-reset email dispatched for job #${job.id}`);
        break;
      }

      default:
        this.logger.warn(`Unknown email job name: "${job.name}" #${job.id}`);
    }
  }
}
