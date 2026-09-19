export type AppErrorCode =
  | 'configuration-invalid'
  | 'storage-integrity-failed'
  | 'validation-invalid'
  | 'vault-already-initialized'
  | 'vault-invalid'
  | 'vault-not-accessible'
  | 'unexpected';

export interface SafeAppError {
  readonly code: AppErrorCode;
  readonly issues?: readonly { readonly code: string; readonly path: string }[];
  readonly retryable: boolean;
}

export class AppError extends Error {
  public readonly code: AppErrorCode;
  public readonly retryable: boolean;
  public readonly issues: readonly { readonly code: string; readonly path: string }[] | undefined;

  public constructor(options: {
    readonly code: AppErrorCode;
    readonly message: string;
    readonly retryable?: boolean;
    readonly cause?: unknown;
    readonly issues?: readonly { readonly code: string; readonly path: string }[];
  }) {
    super(options.message, { cause: options.cause });
    this.name = 'AppError';
    this.code = options.code;
    this.retryable = options.retryable ?? false;
    this.issues = options.issues;
  }

  public toSafeError(): SafeAppError {
    return { code: this.code, issues: this.issues, retryable: this.retryable };
  }
}

export const toSafeAppError = (error: unknown): SafeAppError =>
  error instanceof AppError ? error.toSafeError() : { code: 'unexpected', retryable: false };
