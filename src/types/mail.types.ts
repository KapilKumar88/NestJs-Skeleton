/**
 * Mail-related shared types.
 */

/** Options passed to MailService.sendMail(). */
export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
}
