export type AppErrorCode =
  | 'configuration-invalid'
  | 'storage-integrity-failed'
  | 'vault-already-initialized'
  | 'vault-invalid'
  | 'vault-not-accessible'
  | 'unexpected';

export interface SafeAppError {
  readonly code: AppErrorCode;
  readonly retryable: boolean;
}

export class AppError extends Error {
  public readonly code: AppErrorCode;
  public readonly retryable: boolean;

  public constructor(options: {
    readonly code: AppErrorCode;
    readonly message: string;
    readonly retryable?: boolean;
    readonly cause?: unknown;
  }) {
    super(options.message, { cause: options.cause });
    this.name = 'AppError';
    this.code = options.code;
    this.retryable = options.retryable ?? false;
  }

  public toSafeError(): SafeAppError {
    return { code: this.code, retryable: this.retryable };
  }
}

export const toSafeAppError = (error: unknown): SafeAppError =>
  error instanceof AppError ? error.toSafeError() : { code: 'unexpected', retryable: false };
