import { registerAs } from '@nestjs/config';

export default registerAs('push', () => ({
  serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
  dryRun: process.env.PUSH_DRY_RUN === 'true',
}));
