import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Nodemailer-based mail service.
 * In development, if SMTP credentials are not set, falls back to
 * logging the email instead of throwing (non-fatal).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    const mailConfig = {
      host: this.configService.get<string>('mail.host'),
      port: this.configService.get<number>('mail.port'),
      auth: {
        user: this.configService.get<string>('mail.user'),
        pass: this.configService.get<string>('mail.pass'),
      },
    };

    this.transporter = nodemailer.createTransport(mailConfig);
  }

  async sendMail(options: SendMailOptions): Promise<void> {
    const from = this.configService.get<string>('mail.from');

    try {
      await this.transporter.sendMail({ from, ...options });
      this.logger.log(`Email sent to ${options.to}: "${options.subject}"`);
    } catch (err) {
      // Non-fatal: log the error but don't crash (especially in dev without SMTP)
      this.logger.warn(
        `Failed to send email to ${options.to}: ${(err as Error).message}`,
      );
    }
  }

  async sendWelcome(user: { name: string; email: string }): Promise<void> {
    await this.sendMail({
      to: user.email,
      subject: 'Welcome! 🎉',
      html: `
        <h1>Welcome, ${user.name}!</h1>
        <p>Your account has been created successfully.</p>
        <p>Start adding your todos today.</p>
      `,
    });
  }
}
