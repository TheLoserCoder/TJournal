import { mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

import pino from 'pino';

import type { LogContext, Logger } from './logger';

const LOG_FILE_NAME = 'tjournal.jsonl';
const MILLISECONDS_PER_DAY = 86_400_000;

interface PinoFileLoggerOptions {
  readonly logsDirectory: string;
  readonly retentionDays: number;
}

const removeExpiredLogs = (logsDirectory: string, retentionDays: number): void => {
  const expirationTimestamp = Date.now() - retentionDays * MILLISECONDS_PER_DAY;

  for (const entry of readdirSync(logsDirectory, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.jsonl')) {
      continue;
    }

    const entryPath = join(logsDirectory, entry.name);
    if (statSync(entryPath).mtimeMs < expirationTimestamp) {
      unlinkSync(entryPath);
    }
  }
};

export const createPinoFileLogger = (options: PinoFileLoggerOptions): Logger => {
  mkdirSync(options.logsDirectory, { recursive: true });
  removeExpiredLogs(options.logsDirectory, options.retentionDays);

  const destination = pino.destination(join(options.logsDirectory, LOG_FILE_NAME));
  const logger = pino(
    {
      base: undefined,
      formatters: {
        bindings: () => ({}),
        level: (label) => ({ level: label }),
      },
      redact: [
        'image',
        'note',
        'pnl',
        'profitLoss',
        'screenshot',
        '*.image',
        '*.note',
        '*.pnl',
        '*.profitLoss',
        '*.screenshot',
      ],
    },
    destination,
  );

  const write = (
    level: 'debug' | 'error' | 'info' | 'warn',
    event: string,
    context?: LogContext,
  ): void => {
    logger[level](context ?? {}, event);
  };

  return {
    debug: (event, context) => write('debug', event, context),
    error: (event, context) => write('error', event, context),
    info: (event, context) => write('info', event, context),
    warn: (event, context) => write('warn', event, context),
  };
};
