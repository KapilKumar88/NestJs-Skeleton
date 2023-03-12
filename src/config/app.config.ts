import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  PORT: process.env.PORT || 3000,
}));
