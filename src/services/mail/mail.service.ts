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

  // ─── Specific email templates ─────────────────────────────────────────────

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
    await this.sendMail({
      to: user.email,
      subject: 'Verify your email address',
      html: `
        <h1>Hi ${user.name},</h1>
        <p>Thanks for registering. Please verify your email address to activate your account.</p>
        <p>
          <a href="${user.verifyUrl}" style="
            display:inline-block;padding:12px 24px;background:#4f46e5;
            color:#fff;text-decoration:none;border-radius:6px;font-weight:600
          ">Verify Email</a>
        </p>
        <p>This link expires in <strong>24 hours</strong>.</p>
        <p>If you did not create an account, you can safely ignore this email.</p>
      `,
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
    await this.sendMail({
      to: user.email,
      subject: 'Reset your password',
      html: `
        <h1>Hi ${user.name},</h1>
        <p>We received a request to reset the password for your account.</p>
        <p>
          <a href="${user.resetUrl}" style="
            display:inline-block;padding:12px 24px;background:#dc2626;
            color:#fff;text-decoration:none;border-radius:6px;font-weight:600
          ">Reset Password</a>
        </p>
        <p>This link expires in <strong>1 hour</strong> and can only be used once.</p>
        <p>If you did not request a password reset, you can safely ignore this email.
           Your password will not be changed.</p>
      `,
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
    await this.sendMail({
      to: user.email,
      subject: 'Account already registered',
      html: `
        <h1>Hi ${user.name},</h1>
        <p>Someone (possibly you) tried to register a new account using this email address.</p>
        <p>An account already exists for this email — no changes were made.</p>
        <ul>
          <li>If this was you, please <strong>log in</strong> with your existing password.</li>
          <li>If you forgot your password, use the <strong>forgot password</strong> flow.</li>
          <li>If you did not attempt this, you can safely ignore this email.</li>
        </ul>
      `,
    });
  }
}
