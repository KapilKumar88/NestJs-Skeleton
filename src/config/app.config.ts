import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  PORT: Number.parseInt(process.env.PORT, 10) || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
}));
