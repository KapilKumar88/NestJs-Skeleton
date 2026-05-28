import { registerAs } from '@nestjs/config';

export default registerAs('mail', () => ({
  host: process.env.MAIL_HOST ?? 'smtp.mailtrap.io',
  port: Number.parseInt(process.env.MAIL_PORT ?? '587', 10) || 587,
  user: process.env.MAIL_USER ?? '',
  pass: process.env.MAIL_PASS ?? '',
  from: process.env.MAIL_FROM ?? 'noreply@example.com',
}));
