/**
 * Structured logging with pino
 */

import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  base: {
    service: 'scraper-service',
  },
});

// Create child logger with job context
export function createJobLogger(jobName: string) {
  return logger.child({ job: jobName });
}
