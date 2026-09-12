import { z } from 'zod';

const MINIMUM_LOG_RETENTION_DAYS = 1;
const DEFAULT_LOG_RETENTION_DAYS = 30;

const runtimeConfigurationSchema = z.object({
  logRetentionDays: z
    .number()
    .int()
    .min(MINIMUM_LOG_RETENTION_DAYS)
    .default(DEFAULT_LOG_RETENTION_DAYS),
});

export type RuntimeConfiguration = Readonly<z.output<typeof runtimeConfigurationSchema>>;

export const createRuntimeConfiguration = (input: unknown = {}): RuntimeConfiguration =>
  runtimeConfigurationSchema.parse(input);
