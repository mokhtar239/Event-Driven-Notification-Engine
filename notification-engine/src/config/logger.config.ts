import { randomUUID } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';
import type { Params } from 'nestjs-pino';

export function buildLoggerParams(): Params {
  const isProd = process.env.NODE_ENV === 'production';

  return {
    pinoHttp: {
      level: process.env.LOG_LEVEL ?? (isProd ? 'info' : 'debug'),

      genReqId: (req: IncomingMessage, res: ServerResponse) => {
        const existing =
          (req.headers['x-correlation-id'] as string | undefined) ??
          (req.headers['x-request-id'] as string | undefined);
        const id = existing ?? randomUUID();
        res.setHeader('x-correlation-id', id);
        return id;
      },
      customProps: (req: IncomingMessage) => ({
        correlationId: (req as IncomingMessage & { id?: string }).id,
      }),

      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.headers["x-api-key"]',
          'req.headers["x-signature"]',
          'req.body.password',
          'req.body.apiKey',
          'req.body.token',
          '*.password',
          '*.apiKey',
          '*.token',
        ],
        censor: '[REDACTED]',
      },

      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      autoLogging: {
        ignore: (req: IncomingMessage) =>
          req.url === '/api/v1/health' || req.url === '/api/v1/health/live',
      },
      transport: isProd
        ? undefined
        : {
            target: 'pino-pretty',
            options: {
              singleLine: true,
              translateTime: 'SYS:HH:MM:ss.l',
              ignore: 'pid,hostname',
            },
          },
    },
  };
}
