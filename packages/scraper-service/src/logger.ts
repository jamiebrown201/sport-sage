/**
 * Structured logging with pino
 * Wrapper that handles both (msg, obj) and (obj, msg) patterns
 */

import pino from 'pino';

const baseLogger = pino({
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

// Wrapper that handles both argument orders
function createLogger(base: pino.Logger) {
  return {
    info(msgOrObj: string | object, objOrMsg?: object | string) {
      if (typeof msgOrObj === 'string') {
        if (objOrMsg && typeof objOrMsg === 'object') {
          base.info(objOrMsg, msgOrObj);
        } else {
          base.info(msgOrObj);
        }
      } else {
        base.info(msgOrObj, objOrMsg as string);
      }
    },
    error(msgOrObj: string | object, objOrMsg?: object | string) {
      if (typeof msgOrObj === 'string') {
        if (objOrMsg && typeof objOrMsg === 'object') {
          base.error(objOrMsg, msgOrObj);
        } else {
          base.error(msgOrObj);
        }
      } else {
        base.error(msgOrObj, objOrMsg as string);
      }
    },
    warn(msgOrObj: string | object, objOrMsg?: object | string) {
      if (typeof msgOrObj === 'string') {
        if (objOrMsg && typeof objOrMsg === 'object') {
          base.warn(objOrMsg, msgOrObj);
        } else {
          base.warn(msgOrObj);
        }
      } else {
        base.warn(msgOrObj, objOrMsg as string);
      }
    },
    debug(msgOrObj: string | object, objOrMsg?: object | string) {
      if (typeof msgOrObj === 'string') {
        if (objOrMsg && typeof objOrMsg === 'object') {
          base.debug(objOrMsg, msgOrObj);
        } else {
          base.debug(msgOrObj);
        }
      } else {
        base.debug(msgOrObj, objOrMsg as string);
      }
    },
    child(bindings: pino.Bindings) {
      return createLogger(base.child(bindings));
    },
  };
}

export const logger = createLogger(baseLogger);

// Create child logger with job context
export function createJobLogger(jobName: string) {
  return logger.child({ job: jobName });
}
