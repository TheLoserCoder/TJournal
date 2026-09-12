import { describe, expect, it } from 'vitest';

import { AppError, toSafeAppError } from './app-error';

describe('AppError', () => {
  it('exposes only the safe error information to a renderer', () => {
    const error = new AppError({
      cause: new Error('SQLite stack and vault path'),
      code: 'vault-invalid',
      message: 'Vault marker is invalid.',
      retryable: true,
    });

    expect(error.toSafeError()).toEqual({ code: 'vault-invalid', retryable: true });
  });

  it('maps unexpected errors to a safe generic error', () => {
    expect(toSafeAppError(new Error('private details'))).toEqual({
      code: 'unexpected',
      retryable: false,
    });
  });
});
