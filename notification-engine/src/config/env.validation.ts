import * as Joi from 'joi';

export const envSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  MONGO_URI: Joi.string().required(),
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().required(),
  RABBITMQ_URL: Joi.string().required(),
  RESEND_API_KEY: Joi.string().required(),
  EMAIL_FROM: Joi.string().email().default('onboarding@resend.dev'),
  TWILIO_ACCOUNT_SID: Joi.string().required(),
  TWILIO_AUTH_TOKEN: Joi.string().required(),
  TWILIO_FROM: Joi.string().required(),
  FIREBASE_SERVICE_ACCOUNT_JSON: Joi.string().required(),
  PUSH_DRY_RUN: Joi.string().valid('true', 'false').default('true'),
  WS_PORT: Joi.number().default(3001),
});
