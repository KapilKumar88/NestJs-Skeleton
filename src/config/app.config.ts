import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: Number.parseInt(process.env.PORT, 10) || 3030,
  nodeEnv: process.env.NODE_ENV || 'development',

  // CORS: comma-separated list of allowed origins; empty string = deny all
  corsOrigins: (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  // Maximum request body size (e.g. "1mb", "512kb")
  bodyLimit: process.env.BODY_LIMIT || '1mb',

  // Public app URL — used when building email links (verify, reset)
  appUrl: process.env.APP_URL || 'http://localhost:3030',
}));
