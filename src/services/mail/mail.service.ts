import * as path from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import * as ejs from 'ejs';
import { SendMailOptions } from '../../types/mail.types';

/**
 * Nodemailer-based mail service.
 * In development, if SMTP credentials are not set, falls back to
 * logging the email instead of throwing (non-fatal).
 *
 * Security rules:
 *  - sendMail logs the subject and recipient but NEVER the body
 *    (body may contain verification URLs with raw tokens).
 *  - Delivery failures are warned, not thrown — the queue handles retry policy.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter;

  /**
   * Absolute path to the compiled EJS email templates directory.
   * nest-cli copies `src/templates/` → `dist/templates/` on build.
   */
  private readonly templatesDir: string;

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

    // __dirname is dist/services/mail — go up two levels to dist/, then into templates/emails
    this.templatesDir = path.join(__dirname, '..', '..', 'templates', 'emails');
  }

  // ─── Core send helper ─────────────────────────────────────────────────────────

  async sendMail(options: SendMailOptions): Promise<void> {
    const from = this.configService.get<string>('mail.from');

    try {
      await this.transporter.sendMail({ from, ...options });
      // Log subject only — body may contain tokens/reset links
      this.logger.log(`Email sent: "${options.subject}" → ${options.to}`);
    } catch (err) {
      // Non-fatal: log the error but don't crash (especially in dev without SMTP)
      this.logger.warn(
        `Failed to send email "${options.subject}" → ${options.to}: ${
          (err as Error).message
        }`,
      );
    }
  }

  // ─── EJS template renderer ────────────────────────────────────────────────────

  /**
   * Renders an EJS template from `src/templates/emails/<name>.ejs`
   * and returns the compiled HTML string.
   */
  private async renderTemplate(
    templateName: string,
    data: Record<string, unknown>,
  ): Promise<string> {
    const templatePath = path.join(this.templatesDir, `${templateName}.ejs`);
    return ejs.renderFile(templatePath, data);
  }

  // ─── Specific email senders ───────────────────────────────────────────────────

  async sendWelcome(user: { name: string; email: string }): Promise<void> {
    const html = await this.renderTemplate('welcome', { name: user.name });
    await this.sendMail({
      to: user.email,
      subject: 'Welcome! 🎉',
      html,
    });
  }

  /**
   * Sends the email-verification link to a newly registered user.
   * verifyUrl contains the raw token — it is placed only in the email body
   * and must never be logged.
   */
  async sendVerificationEmail(user: {
    name: string;
    email: string;
    verifyUrl: string;
  }): Promise<void> {
    const html = await this.renderTemplate('verify-email', {
      name: user.name,
      verifyUrl: user.verifyUrl,
    });
    await this.sendMail({
      to: user.email,
      subject: 'Verify your email address',
      html,
    });
  }

  /**
   * Sends a password-reset link to the user.
   * resetUrl contains the raw token — placed only in the email body, never logged.
   * The link expires in 1 hour.
   */
  async sendPasswordReset(user: {
    name: string;
    email: string;
    resetUrl: string;
  }): Promise<void> {
    const html = await this.renderTemplate('password-reset', {
      name: user.name,
      resetUrl: user.resetUrl,
    });
    await this.sendMail({
      to: user.email,
      subject: 'Reset your password',
      html,
    });
  }

  /**
   * Notifies an existing user that someone attempted to register with their email.
   * Lets them know their account is safe and prompts them to log in or reset if needed.
   */
  async sendAccountExistsNotice(user: {
    name: string;
    email: string;
  }): Promise<void> {
    const html = await this.renderTemplate('account-exists-notice', {
      name: user.name,
    });
    await this.sendMail({
      to: user.email,
      subject: 'Account already registered',
      html,
    });
  }
}
