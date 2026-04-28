import { registerAs } from '@nestjs/config';

export default registerAs('email', () => ({
  apiKey: process.env.RESEND_API_KEY,
  from: process.env.EMAIL_FROM ?? 'onboarding@resend.dev',
}));
