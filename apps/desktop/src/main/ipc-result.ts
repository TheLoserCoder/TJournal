import { AppError, toSafeAppError } from '@tjournal/platform-errors';
import type { Logger } from '@tjournal/platform-observability';
import { TagValidationError } from '@tjournal/tag';
import { TradeValidationError } from '@tjournal/trade';

import type { IpcResult } from '../shared/desktop-api';

const normalizeError = (error: unknown): unknown => {
  if (error instanceof TradeValidationError || error instanceof TagValidationError) {
    return new AppError({
      code: 'validation-invalid',
      issues: error.issues,
      message: error.message,
    });
  }
  return error;
};

const logError = (error: unknown, logger: Logger, event: string): IpcResult<never> => {
  const normalizedError = normalizeError(error);
  const safeError = toSafeAppError(normalizedError);
  logger.error(event, {
    code: safeError.code,
    ...(normalizedError instanceof Error ? { detail: normalizedError.message } : {}),
    ...(safeError.issues === undefined ? {} : { issues: JSON.stringify(safeError.issues) }),
  });
  return { error: safeError, ok: false };
};

export const asResult = <T>(operation: () => T, logger: Logger, event: string): IpcResult<T> => {
  try {
    return { ok: true, value: operation() };
  } catch (error) {
    return logError(error, logger, event);
  }
};

export const asAsyncResult = async <T>(
  operation: () => Promise<T>,
  logger: Logger,
  event: string,
): Promise<IpcResult<T>> => {
  try {
    return { ok: true, value: await operation() };
  } catch (error) {
    return logError(error, logger, event);
  }
};
