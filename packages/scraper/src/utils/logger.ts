export interface LogContext {
  job?: string;
  sport?: string;
  eventId?: string;
  [key: string]: unknown;
}

class ScraperLogger {
  private context: LogContext = {};

  setContext(context: LogContext): void {
    this.context = { ...this.context, ...context };
  }

  clearContext(): void {
    this.context = {};
  }

  private formatMessage(level: string, message: string, data?: unknown): string {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.context,
      ...(data && { data }),
    };
    return JSON.stringify(logEntry);
  }

  info(message: string, data?: unknown): void {
    console.log(this.formatMessage('INFO', message, data));
  }

  warn(message: string, data?: unknown): void {
    console.warn(this.formatMessage('WARN', message, data));
  }

  error(message: string, error?: Error | unknown, data?: unknown): void {
    const errorData =
      error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : error;
    console.error(this.formatMessage('ERROR', message, { error: errorData, ...data }));
  }

  debug(message: string, data?: unknown): void {
    if (process.env.LOG_LEVEL === 'DEBUG') {
      console.debug(this.formatMessage('DEBUG', message, data));
    }
  }
}

export const logger = new ScraperLogger();
