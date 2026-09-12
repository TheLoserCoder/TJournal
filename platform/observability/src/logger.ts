export type LogContext = Readonly<Record<string, boolean | null | string>>;

export interface Logger {
  debug(event: string, context?: LogContext): void;
  error(event: string, context?: LogContext): void;
  info(event: string, context?: LogContext): void;
  warn(event: string, context?: LogContext): void;
}
